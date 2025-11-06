"""Command-line utility for batch processing datasets and generating montages.

This module provides a command line interface for iterating over patient and
control datasets, dispatching the core pipeline for each ID and automatically
producing montage imagery from the resulting analysis artefacts.

It mirrors the behaviour of the legacy ``enumerator.py`` script that shipped
with the clinical tooling but extends it with two bits of automation:

* Parametric and projection montages are generated automatically after each
  successful pipeline execution without requiring ``--montage`` on the command
  line.
* Montage colour maps no longer rely on hard-coded minimum and maximum values –
  the renderer now inspects the underlying data to determine sensible limits.

The script continues to expose the ``--montage`` flag for workflows that only
need to re-render imagery without running the full analysis.  When that flag is
used the behaviour matches the historical implementation.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from typing import List, Sequence, Tuple

import utils.settings as settings


def _load_montage_dependencies():
    """Import heavy montage modules lazily."""

    from utils.montage import (
        generate_parametric_montages,
        generate_projection_montages,
        build_population_projection_stats,
    )
    from utils import parameters

    return (
        generate_parametric_montages,
        generate_projection_montages,
        parameters,
        build_population_projection_stats,
    )


def _resolve_dataset_root(data_root: str, dataset_id: str, is_control: bool) -> str:
    """Return the filesystem path for ``dataset_id``."""

    candidates: List[str] = []
    if is_control:
        candidates.append(os.path.join(data_root, "controls", dataset_id))
    candidates.append(os.path.join(data_root, dataset_id))

    for path in candidates:
        if os.path.isdir(path):
            return path
    return candidates[0]


def _run_montage_for_dataset(
    data_root: str,
    dataset_id: str,
    is_control: bool,
    *,
    use_projection: bool = False,
    projection_stats: dict | None = None,
) -> bool:
    """Render parametric montages for ``dataset_id`` if possible."""

    dataset_root = _resolve_dataset_root(data_root, dataset_id, is_control)
    if not os.path.isdir(dataset_root):
        print(f"[montage] Dataset directory missing – skipping: {dataset_root}")
        return False

    analysis_directory = os.path.join(dataset_root, "Analysis")
    image_directory = os.path.join(dataset_root, "Images")
    nifti_directory = os.path.join(dataset_root, "NIfTI")

    required_dirs: Sequence[Tuple[str, str]] = (
        (analysis_directory, "Analysis"),
        (image_directory, "Images"),
        (nifti_directory, "NIfTI"),
    )
    for path, label in required_dirs:
        if not os.path.isdir(path):
            print(f"[montage] {label} directory missing – skipping: {path}")
            return False

    try:
        deps = _load_montage_dependencies()
    except ImportError as exc:
        print(f"[montage] Unable to import montage dependencies: {exc}")
        return False

    if len(deps) == 2:
        generate_parametric_montages, parameters = deps
        generate_projection_montages = None
    elif len(deps) == 3:
        generate_parametric_montages, generate_projection_montages, parameters = deps
    else:
        (
            generate_parametric_montages,
            generate_projection_montages,
            parameters,
            *_,
        ) = deps

    try:
        if bool(is_control or settings.CONTROLS):
            filenames = parameters.control_filenames(nifti_directory)
        else:
            filenames = parameters.global_filenames(nifti_directory)
    except Exception as exc:  # noqa: BLE001 - surface helpful context to CLI users
        print(f"[montage] Failed to discover DCE filename for {dataset_id}: {exc}")
        return False

    dce_filename = filenames[-1] if filenames else None
    if not dce_filename:
        print(
            f"[montage] No DCE filename available – skipping montage rendering for {dataset_id}."
        )
        return False

    dce_path = os.path.join(nifti_directory, dce_filename)
    if not os.path.isfile(dce_path):
        print(f"[montage] DCE file missing – skipping montage rendering: {dce_path}")
        return False

    print(f"[montage] Generating montages for {dataset_id}")
    overall_success = True
    try:
        generate_parametric_montages(analysis_directory, image_directory, dce_path)
    except Exception as exc:  # noqa: BLE001 - runtime errors should surface to the CLI
        print(f"[montage] Failed to generate montages for {dataset_id}: {exc}")
        overall_success = False

    if use_projection:
        if generate_projection_montages is None:
            print("[projection] Projection rendering unavailable – skipping.")
            return overall_success
        try:
            projection_ok = generate_projection_montages(
                analysis_directory,
                image_directory,
                nifti_directory,
                dce_path,
                population_stats=projection_stats,
            )
            overall_success &= bool(projection_ok)
        except Exception as exc:  # noqa: BLE001 - runtime errors should surface to the CLI
            print(
                f"[projection] Failed to generate projection montages for {dataset_id}: {exc}"
            )
            overall_success = False

    return overall_success


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run p-brain on multiple datasets")
    parser.add_argument(
        "--data-dir",
        dest="data_dir",
        type=str,
        default=os.environ.get(
            "P_BRAIN_DATA_DIR",
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
        ),
        help="Directory containing dataset folders",
    )
    parser.add_argument("--all", action="store_true", help="Process all datasets in the data directory")
    parser.add_argument(
        "--from",
        dest="start_id",
        type=str,
        help="Start processing from the specified dataset ID (inclusive)",
    )
    parser.add_argument("ids", nargs="*", help="Specific dataset IDs to process")
    parser.add_argument(
        "--montage",
        action="store_true",
        help="Only generate montage images for the selected datasets",
    )
    parser.add_argument(
        "--projection",
        action="store_true",
        help=(
            "When used with --montage, also render parcel projection montages for atlas metrics"
        ),
    )
    return parser.parse_args()


def _list_subdirectories(path: str) -> List[str]:
    """Return sorted subdirectories under ``path`` (non-recursive)."""

    try:
        entries = sorted(os.listdir(path))
    except FileNotFoundError:
        return []

    result: List[str] = []
    for name in entries:
        full_path = os.path.join(path, name)
        if os.path.isdir(full_path):
            result.append(name)
    return result


def collect_datasets(
    data_directory: str,
    use_all: bool,
    ids: Sequence[str],
    *,
    use_controls: bool = False,
) -> List[Tuple[str, bool]]:
    """Return a list of dataset identifiers to process."""

    datasets: List[Tuple[str, bool]] = []
    data_directory = os.fspath(data_directory)
    controls_directory = os.path.join(data_directory, "controls")

    if use_all:
        if use_controls:
            for name in _list_subdirectories(controls_directory):
                datasets.append((name, True))
        else:
            for name in _list_subdirectories(data_directory):
                if name == "controls":
                    continue
                datasets.append((name, False))

    elif ids:
        for dataset_id in ids:
            dataset_id = str(dataset_id)
            control_path = os.path.join(controls_directory, dataset_id)
            patient_path = os.path.join(data_directory, dataset_id)

            is_control = False
            if os.path.isdir(control_path):
                is_control = True
                dataset_path = control_path
            else:
                dataset_path = patient_path

            if not os.path.isdir(dataset_path):
                raise FileNotFoundError(f"Dataset {dataset_id} not found in {data_directory}.")

            if use_controls:
                is_control = True

            datasets.append((dataset_id, is_control))

    else:
        raise ValueError("No datasets specified")

    return datasets


def _build_projection_stats_if_required(
    data_directory: str, *, include_controls: bool, enabled: bool
) -> dict | None:
    """Compute projection statistics once when projection rendering is requested."""

    if not enabled:
        return None

    try:
        deps = _load_montage_dependencies()
    except ImportError as exc:
        print(f"[projection] Unable to import montage dependencies: {exc}")
        return None

    build_population_projection_stats = None
    if len(deps) >= 4:
        build_population_projection_stats = deps[3]

    if build_population_projection_stats is None:
        return None

    return build_population_projection_stats(
        data_directory,
        include_controls=include_controls,
    )


def main() -> None:
    args = parse_args()
    data_directory = os.path.abspath(args.data_dir)
    use_all = args.all
    ids = args.ids
    start_id = args.start_id

    if not ids and not use_all:
        use_all = True

    try:
        datasets = collect_datasets(
            data_directory,
            use_all,
            ids,
            use_controls=settings.CONTROLS,
        )
    except FileNotFoundError:
        print(f"Data dir missing: {data_directory}")
        sys.exit(1)
    except ValueError as exc:
        print(f"{exc}. Provide log numbers or use --all.")
        sys.exit(1)

    if start_id:
        start_id = str(start_id)
        try:
            start_index = next(
                index for index, (dataset_id, _) in enumerate(datasets) if dataset_id == start_id
            )
        except StopIteration:
            print(f"Start dataset {start_id} not found in selection.")
            sys.exit(1)
        datasets = datasets[start_index:]

    if not datasets:
        print("No datasets found to process.")
        sys.exit(0)

    include_controls = bool(settings.CONTROLS)
    projection_stats = _build_projection_stats_if_required(
        data_directory,
        include_controls=include_controls,
        enabled=args.projection,
    )

    if args.montage:
        exit_code = 0
        for dataset_id, is_control in datasets:
            success = _run_montage_for_dataset(
                data_directory,
                dataset_id,
                is_control,
                use_projection=args.projection,
                projection_stats=projection_stats,
            )
            if not success:
                exit_code = 1
        sys.exit(exit_code)

    command_template = "python3 main.py --id {} --mode auto --data-dir {}"

    exit_code = 0
    for dataset_id, is_control in datasets:
        command = command_template.format(dataset_id, data_directory)
        env = os.environ.copy()
        env["P_BRAIN_DATA_DIR"] = data_directory
        env["PBRAIN_TURBO"] = "1"
        if is_control or include_controls:
            env["PBRAIN_CONTROLS"] = "1"
        else:
            env.pop("PBRAIN_CONTROLS", None)
        print(f"Running: {command}")
        result = subprocess.run(command, shell=True, env=env)
        if result.returncode != 0:
            print(
                f"[pipeline] Command returned non-zero exit code {result.returncode} for {dataset_id}"
            )
            exit_code = result.returncode
            continue

        montage_success = _run_montage_for_dataset(
            data_directory,
            dataset_id,
            is_control,
            use_projection=args.projection,
            projection_stats=projection_stats,
        )
        if not montage_success and exit_code == 0:
            exit_code = 1

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
