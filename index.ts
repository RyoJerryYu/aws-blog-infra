import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { LogBucket } from "./logBucket";
import { WebSite } from "./website";
import { tokyoAWS, CloudFrontAWS } from "./providers/aws";




const logConfig = new pulumi.Config("log");

const logBucket = new LogBucket(`logBucket`, {
    bucketNamePrefix: logConfig.require("bucketNamePrefix"),
}, { provider: tokyoAWS });

export const logBucketName = logBucket.bucket.bucket;




const webConfig = new pulumi.Config("web");

const webSite = new WebSite(`testWebSite`, {
    domainName: webConfig.require("domainName"),
    elbDomainName: webConfig.require("elbDomainName"),
    logBucket: logBucket.bucket,
})
export const webSiteDomainName = webSite.DomainName;
