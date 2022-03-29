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
        const logBucketName = pulumi.interpolate`${args.bucketNamePrefix}-${region}`;
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
                        Resource: pulumi.interpolate`arn:aws:s3:::${logBucketName}/*`,
                    },
                    {
                        Sid: "AWSLogDeliveryWrite",
                        Effect: "Allow",
                        Principal: {
                            Service: "delivery.logs.amazonaws.com"
                        },
                        Action: "s3:PutObject",
                        Resource: pulumi.interpolate`arn:aws:s3:::${logBucketName}/*`,
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
                        Resource: pulumi.interpolate`arn:aws:s3:::${logBucketName}`,
                    },
                    {
                        "Sid": "S3ServerAccessLogsPolicy",
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "logging.s3.amazonaws.com"
                        },
                        "Action": [
                            "s3:PutObject"
                        ],
                        "Resource": pulumi.interpolate`arn:aws:s3:::${logBucketName}/*`,
                    }
                ]
            },
        },  { ...childOpts, import: "ryo-okami.xyz.log-ap-northeast-1" });

        const publicAccessBlock = new aws.s3.BucketPublicAccessBlock("contentBucketPublicAccessBlock", {
            bucket: logBucket.bucket,
            blockPublicAcls: true,
            blockPublicPolicy: false,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
        }, childOpts);



        this.bucket = logBucket;
        this.registerOutputs();
    }
}
