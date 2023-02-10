import * as pulumi from "@pulumi/pulumi";
import { WebSite } from "./website";

const refConfig = new pulumi.Config("ref");
const org = refConfig.require("org");

const commonStack = new pulumi.StackReference(
  `${org}/aws-blog-infra.common/common`
);
const logBucketName = commonStack.getOutput("logBucketName");
const logBucketDomainName = commonStack.getOutput("logBucketDomainName");
const elbCachePolicyId = commonStack.getOutput("elbCachePolicyId");

const lambdaStack = new pulumi.StackReference(
  `${org}/aws-blog-infra.lambda/lambda`
);
const nextBlogViewerRequestQualifiedArn = lambdaStack.getOutput(
  "nextBlogViewerRequestQualifiedArn"
);
const nextBlogOriginRequestQualifiedArn = lambdaStack.getOutput(
  "nextBlogOriginRequestQualifiedArn"
);

const webConfig = new pulumi.Config("web");
const webSite = new WebSite(`testWebSite`, {
  domainName: webConfig.require("domainName"),
  elbDomainName: webConfig.require("elbDomainName"),
  logBucketName: logBucketName,
  logBucketDomainName: logBucketDomainName,
  elbCachePolicyId: elbCachePolicyId,
  viewerRequestLambdaArn: nextBlogViewerRequestQualifiedArn,
  originRequestLambdaArn: nextBlogOriginRequestQualifiedArn,
});
export const webSiteDomainName = webSite.DomainName;
