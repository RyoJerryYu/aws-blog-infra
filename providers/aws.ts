import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";


const tagPrefix = "ryoJerryYu.github.com/aws-blog-infra"

export const tokyoAWS = new aws.Provider("tokyoAWS", {
    profile: aws.config.profile,
    region: "ap-northeast-1",
    defaultTags: {
        tags: {
            PulumiProvider: `${tagPrefix}/tokyo`,
            PulumiProject: `${pulumi.getProject()}`,
            PulumiStack: `${pulumi.getStack()}`,
        }
    }
})

export const CloudFrontAWS = new aws.Provider("CloudFrontAWS", {
    profile: aws.config.profile,
    region: "us-east-1",
    defaultTags: {
        tags: {
            PulumiProvider: `${tagPrefix}/cloudFront`,
            PulumiProject: `${pulumi.getProject()}`,
            PulumiStack: `${pulumi.getStack()}`,
        }
    }
})