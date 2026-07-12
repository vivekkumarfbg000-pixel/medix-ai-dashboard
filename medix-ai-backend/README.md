---
title: Medix AI Backend
emoji: 🏥
colorFrom: cyan
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# MedixAI Python Backend

This is a production-grade AI microservice for MedixAI, providing prescription vision scanning (OCR), look-alike sound-alike (LASA) safety checks, and inventory forecasting.

## Endpoints
- `GET /`: Health status check.
- `POST /api/v1/prescription/analyze`: Structured OCR on prescriptions.
- `POST /api/v1/safety/check`: Phonetic/visual drug safety matching.
- `POST /api/v1/chat/pharmacist`: Stateful clinical chatbot.
- `POST /api/v1/analytics/forecast`: Time-series stock demand forecasting.
