# Deploying AutoFlow to AWS

This guide provides instructions for deploying the AutoFlow monorepo (Dashboard and Server) to AWS. 

## Recommended Architecture

- **Compute:** AWS App Runner (Fastest) or Amazon ECS on Fargate (More Control).
- **Database:** Amazon RDS for PostgreSQL (or Aurora Serverless v2).
- **LLM:** AWS Bedrock (Claude models) or your preferred provider (Groq, OpenAI).
- **Networking:** Public endpoint for the dashboard/API; WebSocket support is required.

---

## Prerequisites

1.  **AWS Account** and **AWS CLI** configured.
2.  **Bun** installed locally (for building/testing).
3.  **Docker** installed and running.

---

## Step 1: Database (Amazon RDS)

AutoFlow requires a PostgreSQL database.

1.  Go to the **RDS Console** and click **Create database**.
2.  Choose **Standard create** > **PostgreSQL**.
3.  **Templates:** Choose **Free Tier** for testing or **Production** for reliability.
4.  **Settings:** Set your `DB instance identifier`, `Master username`, and `Master password`.
5.  **Connectivity:** Ensure "Public access" is set to **Yes** if your compute service (App Runner) is not in the same VPC (or use VPC connectors).
6.  Once created, copy the **Endpoint**. Your connection string will look like:
    `postgresql://username:password@your-endpoint:5432/postgres?sslmode=require`

---

## Step 2: Containerize and Push to ECR

You need to push your Docker image to **Amazon Elastic Container Registry (ECR)**.

1.  **Create an ECR Repository:**
    ```bash
    aws ecr create-repository --repository-name autoflow
    ```
2.  **Authenticate Docker to ECR:**
    ```bash
    aws ecr get-login-password --region your-region | docker login --username AWS --password-stdin your-account-id.dkr.ecr.your-region.amazonaws.com
    ```
3.  **Build and Tag the Image:**
    (Note: The project contains a `docker-compose.yaml`. You may need to create a `Dockerfile` in the root if one doesn't exist, or build from the server/web directories.)
    ```bash
    docker build -t autoflow .
    docker tag autoflow:latest your-account-id.dkr.ecr.your-region.amazonaws.com/autoflow:latest
    ```
4.  **Push the Image:**
    ```bash
    docker push your-account-id.dkr.ecr.your-region.amazonaws.com/autoflow:latest
    ```

---

## Step 3: Deploy to AWS App Runner

App Runner is the easiest way to deploy the AutoFlow monorepo.

1.  Go to the **App Runner Console** and click **Create service**.
2.  **Source:** Choose **Container registry** > **Amazon ECR**.
3.  **Image URI:** Select the image you just pushed.
4.  **Deployment settings:** Choose **Automatic** for CI/CD.
5.  **Service configuration:**
    - **Port:** `3000` (or the port defined in your server/web config).
    - **Environment Variables:**
      - `DATABASE_URL`: Your RDS connection string.
      - `BETTER_AUTH_SECRET`: A random string.
      - `CORS_ORIGIN`: Your App Runner URL (after first deployment).
      - `LLM_PROVIDER`: `bedrock`, `openai`, or `groq`.
      - If using Bedrock: `AWS_REGION=us-east-1` (Ensure the App Runner IAM Role has `AmazonBedrockFullAccess`).
6.  **Review and Create.**

---

## Step 4: Configuration (AWS Bedrock)

To use AWS Bedrock as your LLM provider:

1.  In the AWS Console, go to **Bedrock** > **Model access**.
2.  Request access to models (e.g., **Claude 3.5 Sonnet**).
3.  In your AutoFlow `.env` (or App Runner environment variables):
    ```env
    LLM_PROVIDER=bedrock
    AWS_REGION=us-east-1
    ```
    The agent loop in `src/kernel.ts` will use your local AWS credentials (`~/.aws/credentials`).

---

## Troubleshooting

- **WebSocket Connection:** If using a Load Balancer (via ECS), ensure it has **Sticky Sessions** and **WebSockets** enabled. App Runner supports WebSockets natively.
- **Database Connection:** Ensure the RDS **Security Group** allows inbound traffic from your compute service's IP/Security Group.
- **Monorepo Build:** If the build fails, ensure your `Dockerfile` correctly installs dependencies for all workspaces (`server`, `web`, `packages/*`).
