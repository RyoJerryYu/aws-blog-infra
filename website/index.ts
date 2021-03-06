import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { WebSite } from "./website";
import { tokyoAWS, CloudFrontAWS } from "../providers/aws";


const refConfig = new pulumi.Config("ref");
const org = refConfig.require("org");

const commonStack = new pulumi.StackReference(`${org}/aws-blog-infra.common/common`);
const logBucketName = commonStack.getOutput("logBucketName");
const logBucketDomainName = commonStack.getOutput("logBucketDomainName");
const elbCachePolicyId = commonStack.getOutput("elbCachePolicyId");




const webConfig = new pulumi.Config("web");
const webSite = new WebSite(`testWebSite`, {
    domainName: webConfig.require("domainName"),
    elbDomainName: webConfig.require("elbDomainName"),
    logBucketName: logBucketName,
    logBucketDomainName: logBucketDomainName,
    elbCachePolicyId: elbCachePolicyId,
});
export const webSiteDomainName = webSite.DomainName;
