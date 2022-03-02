import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";


export interface ClusterArgs {
    stackName: string;
    clusterName: string;
    region?: pulumi.Input<string>;
}

export class Cluster extends pulumi.ComponentResource {

    public vpc: pulumi.Output<aws.ec2.Vpc>;
    public region: pulumi.Output<string>;

    constructor(
        name: string,
        args: ClusterArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("blog:cluster", name, args, opts);

        const clusterName = args.clusterName;
        const stackName = args.stackName;
        const childOpts = { ...opts, parent: this };

        const region = args.region ? pulumi.output(args.region) : aws.getRegionOutput({}, opts).name;

        const vpc = new aws.ec2.Vpc("vpc", {
            cidrBlock: "10.0.0.0/16",

            enableDnsHostnames: true,
            tags: {
                Name: `${clusterName}-vpc`,
                PulumiStack: stackName,
            }
        }, childOpts);

        const igw = new aws.ec2.InternetGateway("igw", {
            vpcId: vpc.id,
            tags: {
                Name: `${clusterName}-igw`,
                PulumiStack: stackName,
            }
        }, childOpts);



        this.vpc = pulumi.output(vpc);
        this.region = region;
    }
}