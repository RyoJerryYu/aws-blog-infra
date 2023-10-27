import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { CloudFrontAWS } from "../providers/aws";
import { Certificate } from "./certificate";

function getZoneFromDomain(
  domain: pulumi.Input<string>
): pulumi.Output<string> {
  return pulumi.output(domain).apply((domain) => {
    const parts = domain.split(".");
    if (parts.length < 2) {
      throw new Error(`Invalid domain name: ${domain}`);
    }
    if (parts.length === 2) {
      return domain;
    }

    return parts.slice(1).join(".");
  });
}

export interface WebSiteArgs {
  domainName: string;
  serverDomainName: string;
  logBucketName: pulumi.Input<string>;
  logBucketDomainName: pulumi.Input<string>;
  elbCachePolicyId: pulumi.Input<string>;
  viewerRequestLambdaArn: pulumi.Input<string>;
  originRequestLambdaArn: pulumi.Input<string>;
}

export class WebSite extends pulumi.ComponentResource {
  public contentBucketUri: pulumi.Output<string>;
  public DomainName: pulumi.Output<string>;
  public bucketDomainName: pulumi.Output<string>;
  public bucketEndpoint: pulumi.Output<string>;

  constructor(
    name: string,
    args: WebSiteArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("blog:WebSite", name, args, opts);

    const stackName = `${pulumi.getProject()}-${pulumi.getStack()}-${name}`;
    const parentOpts = { ...opts, parent: this };

    const hostedZoneName = getZoneFromDomain(args.domainName);
    const hostedZoneId = aws.route53.getZoneOutput({
      name: hostedZoneName,
    }).zoneId;

    /**
     * Bucket
     */

    const contentBucket = new aws.s3.Bucket(
      "contentBucket",
      {
        bucket: args.domainName,
        website: {
          indexDocument: "index.html",
          errorDocument: "error.html",
        },
        versioning: {
          enabled: false,
        },
        corsRules: [
          {
            allowedHeaders: ["*"],
            allowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            allowedOrigins: ["*"],
          },
        ],
        loggings: [
          {
            targetBucket: args.logBucketName,
            targetPrefix: `s3-${args.domainName}/`,
          },
        ],
      },
      parentOpts
    );

    const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
      "contentBucketPublicAccessBlock",
      {
        bucket: contentBucket.bucket,
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      parentOpts
    );

    /**
     * Certificate
     */

    // should in us-east-1
    const cert = new Certificate(
      "cert",
      {
        certDomainName: args.domainName,
        hostedZoneId: hostedZoneId,
      },
      { ...parentOpts, provider: CloudFrontAWS }
    );

    /**
     * CloudFront
     */
    const elbOriginRequestPolicyId = aws.cloudfront
      .getOriginRequestPolicyOutput(
        {
          name: "Managed-AllViewer",
        },
        parentOpts
      )
      .apply((policy) => policy.id!);

    const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
      "originAccessIdentity",
      {
        comment: "Origin Access Identity for static website",
      },
      parentOpts
    );

    const distributionAliases = [args.domainName];

    const cdn = new aws.cloudfront.Distribution(
      "cdn",
      {
        enabled: true,
        aliases: distributionAliases,
        origins: [
          {
            originId: contentBucket.arn,
            domainName: contentBucket.websiteEndpoint,
            customOriginConfig: {
              originProtocolPolicy: "http-only",
              httpPort: 80,
              httpsPort: 443,
              originSslProtocols: ["TLSv1.2"],
            },
          },
          {
            originId: args.serverDomainName,
            domainName: args.serverDomainName,
            customOriginConfig: {
              originProtocolPolicy: "http-only",
              httpPort: 1996,
              httpsPort: 443,
              originSslProtocols: ["TLSv1", "TLSv1.1", "TLSv1.2"],
            },
          },
        ],
        defaultRootObject: "index.html",

        orderedCacheBehaviors: [
          {
            targetOriginId: args.serverDomainName,
            pathPattern: "/caculate/*",
            viewerProtocolPolicy: "redirect-to-https",
            allowedMethods: ["GET", "HEAD", "OPTIONS"],
            cachedMethods: ["GET", "HEAD", "OPTIONS"],

            cachePolicyId: args.elbCachePolicyId,
            originRequestPolicyId: elbOriginRequestPolicyId,
          },
        ],

        defaultCacheBehavior: {
          targetOriginId: contentBucket.arn,
          viewerProtocolPolicy: "redirect-to-https",
          cachedMethods: ["GET", "HEAD", "OPTIONS"],
          allowedMethods: ["GET", "HEAD", "OPTIONS"],

          forwardedValues: {
            queryString: false,
            cookies: { forward: "none" },
            headers: ["Origin"],
          },

          minTtl: 600,
          defaultTtl: 86400, // 1 day
          maxTtl: 2592000, // 30 days

          lambdaFunctionAssociations: [
            {
              eventType: "viewer-request",
              lambdaArn: args.viewerRequestLambdaArn,
              includeBody: false,
            },
            {
              eventType: "origin-request",
              lambdaArn: args.originRequestLambdaArn,
              includeBody: false,
            },
          ],
        },

        priceClass: "PriceClass_200",

        restrictions: {
          geoRestriction: {
            restrictionType: "none",
          },
        },
        viewerCertificate: {
          acmCertificateArn: cert.certificate.arn,
          sslSupportMethod: "sni-only",
        },

        loggingConfig: {
          bucket: args.logBucketDomainName,
          includeCookies: false,
          prefix: `cloudFront-${args.domainName}/`,
        },
      },
      parentOpts
    );

    const bucketPolicy = new aws.s3.BucketPolicy(
      "bucketPolicy",
      {
        bucket: contentBucket.id,
        policy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "s3:GetObject",
              Resource: pulumi.interpolate`${contentBucket.arn}/*`,
            },
          ],
        },
      },
      parentOpts
    );

    /**
     * DNS
     */

    const aliasRecord = new aws.route53.Record(
      args.domainName,
      {
        name: args.domainName,
        zoneId: hostedZoneId,
        type: "A",
        aliases: [
          {
            name: cdn.domainName,
            zoneId: cdn.hostedZoneId,
            evaluateTargetHealth: true,
          },
        ],
      },
      parentOpts
    );

    this.contentBucketUri = pulumi.interpolate`s3://${contentBucket.bucket}`;
    this.DomainName = cert.certificate.domainName;
    this.bucketDomainName = contentBucket.bucketDomainName;
    this.bucketEndpoint = contentBucket.websiteEndpoint;
  }
}
