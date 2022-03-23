import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { tokyoAWS } from "../providers/aws";





export interface CertificateArgs {
    certDomainName: pulumi.Input<string>;
    hostedZoneId: pulumi.Input<string>;
}

export class Certificate extends pulumi.ComponentResource {

    public certificate: pulumi.Output<aws.acm.Certificate>;

    constructor(
        name: string,
        args: CertificateArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("blog:Certificate", name, args, opts);


        const parentOpts = { ...opts, parent: this };




        const cert = new aws.acm.Certificate("cert", {
            domainName: args.certDomainName,
            validationMethod: "DNS",
            subjectAlternativeNames: [pulumi.interpolate`*.${args.certDomainName}`],
            tags: {
                Name: `${args.certDomainName}-cert`,
            }
        }, parentOpts);


        const validationFqdn = cert.domainValidationOptions.apply(v => {
            const dnsRecord = new aws.route53.Record(`validation`, {
                name: v[0].resourceRecordName,
                type: v[0].resourceRecordType,
                records: [v[0].resourceRecordValue],
                zoneId: args.hostedZoneId,
                ttl: 600, // ten minutes
            }, parentOpts);
            return dnsRecord.fqdn;
        });



        const certValidation = new aws.acm.CertificateValidation("certValidation", {
            certificateArn: cert.arn,
            validationRecordFqdns: [validationFqdn],
        }, parentOpts);


        this.certificate = pulumi.output(cert);
        this.registerOutputs();

    }
}