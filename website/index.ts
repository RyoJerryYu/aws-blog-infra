import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Certificate } from "./certificate";
import { CloudFrontAWS } from "../providers/aws";


function getZoneFromDomain(domain: pulumi.Input<string>): pulumi.Output<string> {
    return pulumi.output(domain).apply(domain => {
        const parts = domain.split(".");
        if (parts.length < 2) {
            throw new Error(`Invalid domain name: ${domain}`);
        }
        if (parts.length === 2) {
            return domain;
        }

        return parts.slice(1).join(".")
    })
}

export interface WebSiteArgs {
    domainName: string;
    elbDomainName: string;
    logBucket: aws.s3.Bucket;
}

export class WebSite extends pulumi.ComponentResource {


    public contentBucketUri: pulumi.Output<string>;
    public DomainName: pulumi.Output<string>;
    public bucketDomainName: pulumi.Output<string>;
    public bucketEndpoint: pulumi.Output<string>;


    constructor(
        name: string,
        args: WebSiteArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("blog:WebSite", name, args, opts);



        const stackName = `${pulumi.getProject()}-${pulumi.getStack()}-${name}`;
        const parentOpts = { ...opts, parent: this };



        const hostedZoneName = getZoneFromDomain(args.domainName);
        const hostedZoneId = aws.route53.getZoneOutput({ name: hostedZoneName }).zoneId;

        /**
         * Bucket
         */

        const contentBucket = new aws.s3.Bucket("contentBucket", {
            bucket: args.domainName,
            website: {
                indexDocument: "index.html",
                errorDocument: "error.html",
            },
            versioning: {
                enabled: false,
            },
            loggings: [
                {
                    targetBucket: args.logBucket.bucket,
                    targetPrefix: `s3-${args.domainName}/`,
                }
            ]
        }, parentOpts);

        const publicAccessBlock = new aws.s3.BucketPublicAccessBlock("contentBucketPublicAccessBlock", {
            bucket: contentBucket.bucket,
            blockPublicAcls: true,
            blockPublicPolicy: false,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
        }, parentOpts);



        /**
         * Certificate
         */

        // should in us-east-1
        const cert = new Certificate("cert", {
            certDomainName: args.domainName,
            hostedZoneId: hostedZoneId,
        }, { ...parentOpts, provider: CloudFrontAWS });



        /**
         * CloudFront
         */
        const edgeLambdaArn = aws.lambda.getFunctionOutput({
            functionName: "CloudFrontS3SimplfyPath",
            qualifier: "1",
        }, { ...parentOpts, provider: CloudFrontAWS }).qualifiedArn;

        const elbCachePolicy = new aws.cloudfront.CachePolicy("elbCachePolicy", {
            comment: "ELB Cache Policy",
            minTtl: 60,
            maxTtl: 60,
            defaultTtl: 60,
            parametersInCacheKeyAndForwardedToOrigin: {
                headersConfig: {
                    headerBehavior: "none",
                },
                cookiesConfig: {
                    cookieBehavior: "none",
                },
                queryStringsConfig: {
                    queryStringBehavior: "none",
                },
            },
        })
        const elbOriginRequestPolicyId = aws.cloudfront.getOriginRequestPolicyOutput({
            name: "Managed-AllViewer",
        }, parentOpts).apply(policy => policy.id!);


        const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity("originAccessIdentity", {
            comment: "Origin Access Identity for static website",
        }, parentOpts);

        const distributionAliases = [args.domainName];

        const cdn = new aws.cloudfront.Distribution("cdn", {
            enabled: true,
            aliases: distributionAliases,
            origins: [
                {
                    originId: contentBucket.arn,
                    domainName: contentBucket.bucketDomainName,
                    s3OriginConfig: {
                        originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
                    }
                },
                {
                    originId: args.elbDomainName,
                    domainName: args.elbDomainName,
                    customOriginConfig: {
                        originProtocolPolicy: "https-only",
                        httpPort: 80,
                        httpsPort: 443,
                        originSslProtocols: ["TLSv1", "TLSv1.1", "TLSv1.2"],
                    }
                }
            ],
            defaultRootObject: "index.html",


            orderedCacheBehaviors: [
                {
                    targetOriginId: args.elbDomainName,
                    pathPattern: "/caculate/*",
                    viewerProtocolPolicy: "redirect-to-https",
                    allowedMethods: ["GET", "HEAD", "OPTIONS"],
                    cachedMethods: ["GET", "HEAD", "OPTIONS"],

                    cachePolicyId: elbCachePolicy.id,
                    originRequestPolicyId: elbOriginRequestPolicyId,
                }
            ],

            defaultCacheBehavior: {
                targetOriginId: contentBucket.arn,
                viewerProtocolPolicy: "redirect-to-https",
                cachedMethods: ["GET", "HEAD", "OPTIONS"],
                allowedMethods: ["GET", "HEAD", "OPTIONS"],

                forwardedValues: {
                    queryString: false,
                    cookies: { forward: "none" },
                },

                minTtl: 0,
                defaultTtl: 600,
                maxTtl: 600,

                lambdaFunctionAssociations: [
                    {
                        eventType: "origin-request",
                        includeBody: false,
                        lambdaArn: edgeLambdaArn,
                    }
                ],
            },

            priceClass: "PriceClass_100",


            customErrorResponses: [
                {
                    errorCode: 403,
                    responsePagePath: "/index.html",
                    responseCode: 200,
                }
            ],
            restrictions: {
                geoRestriction: {
                    restrictionType: "none",
                }
            },
            viewerCertificate: {
                acmCertificateArn: cert.certificate.arn,
                sslSupportMethod: "sni-only",
            },

            loggingConfig: {
                bucket: args.logBucket.bucketDomainName,
                includeCookies: false,
                prefix: `cloudFront-${args.domainName}/`,
            }
        }, parentOpts);

        const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
            bucket: contentBucket.id,
            policy: pulumi.all([originAccessIdentity.iamArn, contentBucket.arn]).apply(([iamArn, bucketArn]) => {
                return JSON.stringify({
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Effect: "Allow",
                            Principal: {
                                AWS: iamArn,
                            },
                            Action: "s3:GetObject",
                            Resource: `${bucketArn}/*`,
                        }
                    ]
                })
            })
        }, parentOpts);


        /**
         * DNS
         */

        const aliasRecord = new aws.route53.Record(args.domainName, {
            name: args.domainName,
            zoneId: hostedZoneId,
            type: "A",
            aliases: [
                {
                    name: cdn.domainName,
                    zoneId: cdn.hostedZoneId,
                    evaluateTargetHealth: true,
                }
            ]
        }, parentOpts);



        this.contentBucketUri = pulumi.interpolate`s3://${contentBucket.bucket}`
        this.DomainName = cert.certificate.domainName;
        this.bucketDomainName = contentBucket.bucketDomainName;
        this.bucketEndpoint = contentBucket.websiteEndpoint;
    }
}