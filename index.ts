import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { LogBucket } from "./logBucket";
import { Cluster } from "./cluster";

const stackName = `${pulumi.getProject()}-${pulumi.getStack()}`;
const stackConfig = new pulumi.Config("stack");
const awsConfig = new pulumi.Config("aws");

const config = {
    region: awsConfig.require("region"),
    hostedZone: stackConfig.require("hostedZone"),
}


const logBucket = new LogBucket(`logBucket`, {
    stackName: stackName,
    region: config.region,
})

const cluster = new Cluster(`cluster`, {
    stackName: stackName,
    clusterName: stackName,
    region: config.region,
})

export const bucketName = logBucket.bucket.bucket;

