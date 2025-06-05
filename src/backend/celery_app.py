import os
try:
    from celery import Celery  # type: ignore
except Exception:  # pragma: no cover - optional
    class Celery:  # minimal stub for tests when celery isn't installed
        class _Conf:
            def update(self, *a, **k):
                pass

        class _Control:
            def revoke(self, *a, **k):
                pass

        def __init__(self, *a, **k):
            self.conf = Celery._Conf()
            self._control = Celery._Control()

        def task(self, *a, **k):
            def decorator(func):
                class DummyTask:
                    def __init__(self, f):
                        self.f = f

                    def apply_async(self, args=None, kwargs=None, task_id=None):
                        if args is None:
                            args = []
                        if kwargs is None:
                            kwargs = {}
                        return self.f(self, *args, **kwargs)

                    def delay(self, *args, **kwargs):
                        return self.f(self, *args, **kwargs)

                    def run(self, *args, **kwargs):
                        return self.f(self, *args, **kwargs)

                    def __call__(self, *args, **kwargs):
                        return self.f(self, *args, **kwargs)

                return DummyTask(func)

            return decorator

        @property
        def control(self):
            return self._control

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery = Celery(
    "bmbr",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
