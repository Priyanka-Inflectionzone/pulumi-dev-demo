import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

//Create a VPC for dev env
const main = new aws.ec2.Vpc("dev-vpc", {
    cidrBlock: "10.0.0.0/16",
    instanceTenancy: "default",
    tags: {
        Name: "dev-vpc",
    },
});

// Create one public and one private subnet
const publicSubnet = new aws.ec2.Subnet("dev-public-subnet", {
    vpcId: main.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "ap-south-1c",
    tags: {
        Name: "dev-public-subnet",
    },
});

const privateSubnet = new aws.ec2.Subnet("dev-private-subnet", {
    vpcId: main.id,
    cidrBlock: "10.0.2.0/24",
    availabilityZone: "ap-south-1b",
    tags: {
        Name: "dev-private-subnet",
    },
});

//Configure an Internet Gateway
const gw = new aws.ec2.InternetGateway("dev-igw", {
    vpcId: main.id,
    tags: {
        Name: "dev-igw",
    },
});

// Route tables for two subnets
const publicRt = new aws.ec2.RouteTable("dev-public-rt", {
    vpcId: main.id,
    routes: [
        // {
        //     cidrBlock: "10.0.0.0/16",
        //     gatewayId: gw.id,
        // },
        {
            cidrBlock: "0.0.0.0/0",
            gatewayId: gw.id,
        },
        
    ],
    tags: {
        Name: "dev-public-rt",
    },
});

const privateRt = new aws.ec2.RouteTable("dev-private-rt", {
    vpcId: main.id,
    routes: [
        // {
        //     cidrBlock: "10.0.0.0/16",
        //     gatewayId: gw.id,
        // },
        {
            cidrBlock: "0.0.0.0/0",
            gatewayId: gw.id,
        }
    ],
    tags: {
        Name: "dev-private-rt",
    },
}); 

const publicRtAssociation = new aws.ec2.RouteTableAssociation("public-rt-association", {
    subnetId: publicSubnet.id,
    routeTableId: publicRt.id,
}); 

const privateRtAssociation = new aws.ec2.RouteTableAssociation("private-rt-association", {
    subnetId: privateSubnet.id,
    routeTableId: privateRt.id,
});



// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("deft-source-bucket", {
    acl: "private",
    tags: {
        Name: "deft-source-bucket",
    },
});


// Create Security groups

const devSG = new aws.ec2.SecurityGroup("dev-sg", {
    description: "EC2 Security Group",
    vpcId: main.id,
    ingress: [{
        description: "Allow HTTPS",
        fromPort: 443,
        toPort: 443,
        protocol: "tcp",
        cidrBlocks: [main.cidrBlock],
    },
    {
        description: "Allow HTTP",
        fromPort: 80,
        toPort: 80,
        protocol: "tcp",
        cidrBlocks: [main.cidrBlock],
    },
    {
        description: "Allow SSH",
        fromPort: 22,
        toPort: 22,
        protocol: "tcp",
        cidrBlocks: [main.cidrBlock],
    }],
    egress: [{
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
        ipv6CidrBlocks: ["::/0"],
    }],
    tags: {
        Name: "dev-sg",
    },
});

const dbSG = new aws.ec2.SecurityGroup("dev-db-sg", {
    description: "Allow requests from public subnet",
    vpcId: main.id,
    ingress: [{
        description: "Allow DB",
        fromPort: 5432,
        toPort: 5432,
        protocol: "tcp",
        cidrBlocks: [main.cidrBlock],
    }],
    egress: [{
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
        ipv6CidrBlocks: ["::/0"],
    }],
    tags: {
        Name: "dev-db-sg",
    },
}); 

const subnetGroup = new aws.rds.SubnetGroup("db-subnet-group", {
    subnetIds: [
        publicSubnet.id,
        privateSubnet.id,
    ],
    tags: {
        Name: "My DB subnet group",
    },
}); 

const config = new pulumi.Config();
const dbUsername = config.require("dbUsername");
const dbPassword = config.require("dbPassword");

const db = new aws.rds.Instance("deftsourcedb", {
    allocatedStorage: 10,
    dbName: "deftsourcedb",
    engine: "postgres",
    engineVersion: "14.6",
    instanceClass: "db.t3.micro",
    dbSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: [dbSG.id],
    // parameterGroupName: "default.postgres14.6",
    password: dbPassword,
    skipFinalSnapshot: true,
    username: dbUsername,
}); 

