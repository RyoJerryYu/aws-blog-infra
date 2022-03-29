import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export function MakeElbCachePolicy(
    opts?: pulumi.ComponentResourceOptions,
): aws.cloudfront.CachePolicy {
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
    }, opts);

    return elbCachePolicy;
}
