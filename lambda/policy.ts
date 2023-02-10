import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function attachPolicy(
  name: string,
  description: string,
  role: aws.iam.Role,
  policyDoc: aws.iam.PolicyDocument,
  opts?: pulumi.CustomResourceOptions
) {
  const policy = new aws.iam.Policy(name, {
    name: name,
    description: description,
    policy: policyDoc,
  });

  const policyAttachment = new aws.iam.RolePolicyAttachment(name, {
    role: role,
    policyArn: policy.arn,
  });
}
