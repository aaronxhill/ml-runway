var fs = require('fs');
var et = fs.readFileSync('emailTemplate.txt').toString();
var Mustache = require('mustache');
var winston = require('winston');

module.exports = {

emailPlane: function (foto, status) {
    var emailContent = [];
    var templateContent, emailSubject, output; 
    var emailTo = 'runwaycam@mg.flyingdollar.email';

    emailContent[0] = new Object();
    emailContent[0].eHeader = 'Flying Dollar has a visitor!';
    emailContent[0].eMessage = "The Runway Cam at Flying Dollar spotted a plane. We thought you'd like to know.";
    emailContent[0].eButton = "Visit Flying Dollar";
    emailContent[0].eUrl = "http://www.flyingdollar.com";
    
    emailContent[1] = new Object();
    emailContent[1].eHeader = 'Unidentified flying object!';
    emailContent[1].eMessage = "The Runway Cam detected an object that may or may not be a plane. If it is a plane, please let us know:";
    emailContent[1].eButton = "It's a plane!";
    // emailContent[1].eUrl = 'http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto;
    emailContent[1].eUrl = "http://www.flyingdollar.com";
    
    emailContent[2] = new Object();
    emailContent[2].eHeader = 'Squirrels, turkeys, bears, bugs, and tractors.';
    emailContent[2].eMessage = "The Runway Cam detected an object that is unlikely to be a plane. But if it is a plane, please let us know:";
    emailContent[2].eButton = "It's a plane!";
    // emailContent[2].eUrl = 'http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto;
    emailContent[2].eUrl = "http://www.flyingdollar.com";


    if (status==false) {
        templateContent = emailContent[2];
        templateContent.eFoto = 'http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto; 
        output = Mustache.render(et, templateContent);
        emailSubject = 'Runway Cam Activity';
        emailTo = 'aaron.hill@me.com'
    }
    
    else if (status==true) {
        templateContent = emailContent[0];
        templateContent.eFoto = 'http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto; 
        output = Mustache.render(et, templateContent);
        emailSubject = 'Plane at Flying Dollar Airport';
    }
    
    else if (status==null) {
        templateContent = emailContent[1];
        templateContent.eFoto = 'http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto; 
        output = Mustache.render(et, templateContent);
        emailSubject = 'Unidentified Flying Object at 8N4';
    }

    var mailcomposer = require('mailcomposer');
    var api_key = process.env.MAILGUN_KEY;
    var domain = 'mg.flyingdollar.email';
    var mailgun = require('mailgun-js')({
        apiKey: api_key,
        domain: domain
    });

    var mail = mailcomposer({
        from: 'Do Not Reply <postmaster@mg.flyingdollar.email>',
        to: emailTo,
        subject: emailSubject,
        text: 'Runway Cam activity at Flying Dollar Airport! See the image at http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto,
        html: output
    });

    mail.build(function(mailBuildError, message) {

        var dataToSend = {
            to: emailTo,
            message: message.toString('ascii')
        };

        mailgun.messages().sendMime(dataToSend, function(sendError, body) {
            if (sendError) {
                winston.info("COMM: MailGun sendMime error: ", sendError);
                return;
            }
        });
    });

},

// TWILIO
sendMms: function (foto, cellNumbers) {
	var client = require('twilio')(process.env.TWILIO_ACCOUNTSID, process.env.TWILIO_AUTHTOKEN); 
	var fotoUrl = "http://ml-runway.s3-website-us-east-1.amazonaws.com/" + foto; 
	
		for (var i=0; i<cellNumbers.length; i++) { 
			client.messages.create({ 
			    to: cellNumbers[i], 
			    from: "+19177088720", 
			    body: "Flying Dollar has a visitor!", 
			    mediaUrl: fotoUrl,  
			}, function(err, message) { 
                if (err) {winston.info("COMM: Twilio client.messages.create error: ", err))}
                else {winston.info(message.sid); }
			});
		}
}

};