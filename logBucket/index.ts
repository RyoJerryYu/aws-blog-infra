import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";



export interface LogBucketArgs {
    bucketNamePrefix: string;
}

export class LogBucket extends pulumi.ComponentResource {

    public bucket: aws.s3.Bucket;

    constructor(
        name: string,
        args: LogBucketArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("blog:logBucket", name, args, opts);

        const childOpts = { ...opts, parent: this };


        const region = aws.getRegionOutput().name;
        const logBucketName = `${args.bucketNamePrefix}-${region}`;
        const logBucket = new aws.s3.Bucket("logBucket", {
            bucket: logBucketName,
            policy: { // to allow access from LB log
                Version: "2012-10-17",
                Statement: [
                    {
                        Sid: "AWSELBLogs",
                        Effect: "Allow",
                        Principal: {
                            AWS: aws.elb.getServiceAccountOutput({ region: region }).arn
                        },
                        Action: "s3:PutObject",
                        Resource: `arn:aws:s3:::${logBucketName}/*`,
                    },
                    {
                        Sid: "AWSLogDeliveryWrite",
                        Effect: "Allow",
                        Principal: {
                            Service: "delivery.logs.amazonaws.com"
                        },
                        Action: "s3:PutObject",
                        Resource: `arn:aws:s3:::${logBucketName}/*`,
                        Condition: {
                            StringEquals: {
                                "s3:x-amz-acl": "bucket-owner-full-control"
                            }
                        }
                    },
                    {
                        Sid: "AWSLogDeliveryAclCheck",
                        Effect: "Allow",
                        Principal: {
                            Service: "delivery.logs.amazonaws.com"
                        },
                        Action: "s3:GetBucketAcl",
                        Resource: `arn:aws:s3:::${logBucketName}`,
                    }
                ]
            }
        }, childOpts);

        this.bucket = logBucket;
        this.registerOutputs();
    }
}
