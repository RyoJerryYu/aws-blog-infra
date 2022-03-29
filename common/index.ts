import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { LogBucket } from "./logBucket";
import { tokyoAWS, CloudFrontAWS } from "../providers/aws";


const commonConfig = new pulumi.Config("common");


const logBucket = new LogBucket(`logBucket`, {
    bucketNamePrefix: commonConfig.require("bucketNamePrefix"),
}, { provider: tokyoAWS });

export const logBucketName = logBucket.bucket.bucket;
export const logBucketDomainName = logBucket.bucket.bucketDomainName;
