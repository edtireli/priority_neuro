import React from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
} from "@mui/material";

export default function Dashboard() {
  const navigate = useNavigate();

  const handleConfigureClick = async () => {
    try {
      // 1) create a new, blank project on the backend
      const res = await api.post("/projects", {
        name: "Untitled experiment",
        description: "",
      });
      const projectId = res.data.id;
      // 2) navigate to the wizard route for that new project
      navigate(`/projects/${projectId}/configure`);
    } catch (err) {
      console.error("Failed to create project:", err);
      alert("Could not start a new project, please try again");
    }
  };

  const cards = [
    {
      title: "Configure Project",
      description:
        "Set up model, priors, design variables, objective, constraints.",
      onClick: handleConfigureClick,
    },
    {
      title: "Run Optimisation",
      description: "Launch BOED jobs and monitor status.",
      to: "/jobs",
    },
    {
      title: "View Results",
      description: "Inspect completed job outputs and visuals.",
      to: "/results",
    },
    {
      title: "User Profile",
      description: "Manage account and settings.",
      to: "/profile",
    },
  ];

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Welcome to Priority
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        {cards.map((card) => (
          <Grid key={card.title} item xs={12} sm={6} md={3}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {card.to ? (
                <CardActionArea component={Link} to={card.to} sx={{ height: "100%" }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h6" component="h2">
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              ) : (
                <CardActionArea onClick={card.onClick} sx={{ height: "100%" }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h6" component="h2">
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
