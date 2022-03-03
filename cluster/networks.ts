import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";


export interface ClusterNetworkArgs {
    stackName: string;
    clusterName: string;
}

export class ClusterNetwork extends pulumi.ComponentResource {
    public vpcId: pulumi.Output<string>;
    public publicSubnetIds: pulumi.Output<string[]>;

    constructor(
        name: string,
        args: ClusterNetworkArgs,
        opts?: pulumi.ComponentResourceOptions
    ) {
        super("blog:ClusterNetwork", name, args, opts);

        const clusterName = args.clusterName;
        const stackName = args.stackName;
        const childOpts = { ...opts, parent: this };

        const region = aws.getRegionOutput({}, opts).name;
        const zones = aws.getAvailabilityZonesOutput({
            state: "available",
        }, opts).names;


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

        const publicRouteTable = new aws.ec2.RouteTable("publicRouteTable", {
            vpcId: vpc.id,
            routes: [
                {
                    cidrBlock: "0.0.0.0/0",
                    gatewayId: igw.id,
                },
            ],
            tags: {
                Name: `${clusterName}-publicRouteTable`,
                PulumiStack: stackName,
            }
        }, childOpts);

        const publicSubnetIds = zones.apply(zones => zones.map((az, i) => {
            const subnet = new aws.ec2.Subnet(`publicSubnet-${az}`, {
                vpcId: vpc.id,
                availabilityZone: az,
                cidrBlock: `10.0.${i}.0/24`,
                mapPublicIpOnLaunch: true,
                tags: {
                    Name: `${clusterName}-publicSubnet-${az}`,
                    PulumiStack: stackName,
                    [`kubernetes.io/role/elb`]: "1",
                    [`kubernetes.io/cluster/${clusterName}`]: "owned",
                }
            }, childOpts);

            const publicRouteTableAssociation = new aws.ec2.RouteTableAssociation(
                `publicRouteTableAssociation-${az}`,
                {
                    routeTableId: publicRouteTable.id,
                    subnetId: subnet.id,
                },
                childOpts,
            );

            return subnet.id;
        }));

        this.vpcId = pulumi.output(vpc.id);
        this.publicSubnetIds = pulumi.output(publicSubnetIds);
        this.registerOutputs();
    }
}