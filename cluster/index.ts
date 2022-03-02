import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

import { ClusterNetwork } from "./networks";


export interface ClusterArgs {
    stackName: string;
    clusterName: string;
    // use region configured in provider
    // region?: pulumi.Input<string>;
}

export class Cluster extends pulumi.ComponentResource {

    public vpcId: pulumi.Output<string>;

    constructor(
        name: string,
        args: ClusterArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("blog:cluster", name, args, opts);

        const clusterName = args.clusterName;
        const stackName = args.stackName;
        const childOpts = { ...opts, parent: this };


        const network = new ClusterNetwork(`network`, {
            stackName: stackName,
            clusterName: clusterName,
        }, childOpts);

        const cluster = new eks.Cluster("cluster", {
            name: clusterName,
            vpcId: network.vpcId,
            publicSubnetIds: network.publicSubnetIds,
            skipDefaultNodeGroup: true,
        }, childOpts);



        this.vpcId = pulumi.output(network.vpcId);
    }
}