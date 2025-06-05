import React from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
} from "@mui/material";

export default function Dashboard() {
  const cards = [
    {
      title: "Configure Project",
      description:
        "Set up model, priors, design variables, objective, constraints.",
      to: "/configure",
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
        Welcome to Neuro-Exp-Design
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        {cards.map((card) => (
          <Grid key={card.title} item xs={12} sm={6} md={3}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s",
                "&:hover": { transform: "scale(1.05)" },
              }}
            >
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
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
