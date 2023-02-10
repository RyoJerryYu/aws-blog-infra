import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { CloudFrontAWS } from "../providers/aws";
import { attachPolicy } from "./policy";

const lambdaConfig = new pulumi.Config("lambda");

const lambdaRole = new aws.iam.Role("lambdaRole", {
  name: "lambda-role",
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: {
          Service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
        },
        Effect: "Allow",
        Sid: "",
      },
    ],
  },
});

const logGroup = new aws.cloudwatch.LogGroup(
  "lambdaLogGroup",
  {
    name: "/aws/lambda",
    retentionInDays: 30,
  },
  { provider: CloudFrontAWS }
);

attachPolicy(
  "lambdaLog",
  "Allow lambda to write logs to CloudWatch",
  lambdaRole,
  {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "logs:CreateLogGroup",
        Resource: "arn:aws:logs:us-east-1:260003708177:*",
      },
      {
        Effect: "Allow",
        Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
        Resource: [logGroup.arn],
      },
    ],
  },
  { provider: CloudFrontAWS }
);

const nextBlogViewerRequest = new aws.lambda.Function(
  "nextBlogViewerRequest",
  {
    code: new pulumi.asset.AssetArchive({
      ".": new pulumi.asset.FileArchive("./lambdas/nextBlogViewerRequest"),
    }),
    handler: "index.handler",
    role: lambdaRole.arn,
    runtime: "nodejs16.x",
    memorySize: 128,
    timeout: 5,
    publish: true,
  },
  { provider: CloudFrontAWS }
);

const nextBlogOriginRequest = new aws.lambda.Function(
  "nextBlogOriginRequest",
  {
    code: new pulumi.asset.AssetArchive({
      ".": new pulumi.asset.FileArchive("./lambdas/nextBlogOriginRequest"),
    }),
    handler: "index.handler",
    role: lambdaRole.arn,
    runtime: "nodejs16.x",
    memorySize: 128,
    timeout: 5,
    publish: true,
  },
  { provider: CloudFrontAWS }
);

export const nextBlogViewerRequestArn = nextBlogViewerRequest.arn;
export const nextBlogViewerRequestQualifiedArn =
  nextBlogViewerRequest.qualifiedArn;
export const nextBlogOriginRequestArn = nextBlogOriginRequest.arn;
export const nextBlogOriginRequestQualifiedArn =
  nextBlogOriginRequest.qualifiedArn;
