var AWS = require('aws-sdk');
var getIP = require('external-ip')();
var whois = require('whois')
var http = require('http');

var GROUP_ID = "sg-156df972"
var REGION = "us-east-1"

var ec2 = new AWS.EC2({
  "region": REGION,
  "sslEnabled": true,
  "accessKeyId": process.env.NPM_AWS_ACCESS_KEY_ID,
  "secretAccessKey": process.env.NPM_AWS_SECRET_ACCESS_KEY
});

/**
 * Travis nodes don't have their own routeable IPs, so we assume that they're
 * connecting via some sort of NAT and further that each node will only NAT via
 * a single external IP
 */
var ip = getIP(function(err, ip) {
  if (err) {
    console.error(err);
    process.exit(1)
  }

  console.log("My IP: " + ip);

  // Use whois to find out CIDR IP Block
  whois.lookup(ip, function(err, data) {
    if (err) {
      console.error(err);
      process.exit(1)
    }

    whois_data = {}
    var lines = data.split(/\n/g);
    for (var i in lines) {
      var line = lines[i];
      if (line && line.trim() && line.indexOf('%') != 0 && line.indexOf('#') != 0) {
        var dataValuePair =  line.split(":");
        if (dataValuePair.length == 2) {
          var name = dataValuePair[0].trim()
            , value = dataValuePair[1].trim();
          whois_data[name] = value;
        }
      }
    }

    console.log("My CIDR: " + whois_data["CIDR"]);

    // Make sure our CIDR is in the security group
    var params = {
      DryRun: false,
      Filters: [
      {
        "Name": 'ip-permission.cidr',
        "Values": [ whois_data["CIDR"] ]
      }
      ],
      "GroupIds": [ GROUP_ID ]
    };
    ec2.describeSecurityGroups(params, function(err, data) {
      if (err) {
        console.error(err);
        process.exit(1)
      }

      console.log(data);

      // If we got a security group, try and add our CIDR
      if (data["SecurityGroups"].length > 0) {
        console.log("adding " + whois_data["CIDR"] + " to whitelist...");
        var params = {
          CidrIp: whois_data["CIDR"],
          DryRun: false,
          FromPort: 8080,
          GroupId: GROUP_ID,
          IpProtocol: 'tcp',
          ToPort: 8080
        };
        ec2.authorizeSecurityGroupIngress(params, function(err, data) {
          if (err) {
            console.error(err);
            if (err["code"] == 'InvalidPermission.Duplicate') {
              console.log("This rule already exists!");
            } else {
              process.exit(1)
            }
          } else {
            console.log(data);
          }
        });
      }

      // Test our connectivity
      var req = http.get({"host": "npm-ext.hfa.io", "port": 8080}, function(res) {
        console.log('Connected to NPM!');
        console.log('Status: ' + res.statusCode);
      }).on('error', function(e) {
        console.error("Got error: " + e.message);
        process.exit(1)
      });
      req.setTimeout(5000);
    });
  });
});