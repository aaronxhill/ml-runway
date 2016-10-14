var fs = require('fs');
var AWS = require('aws-sdk');

// OPTIONS

AWS.config.region = 'us-east-1';

// VIEWER IN S3
function saveIndex() {
    var params = {
        Bucket: 'ml-runway' /* required */
            //   ContinuationToken: 'STRING_VALUE',
            //   Delimiter: 'STRING_VALUE',
            //   EncodingType: 'url',
            //   FetchOwner: true || false,
            //   MaxKeys: 10
            //   Prefix: 'STRING_VALUE',
            //   StartAfter: '2016-10-01T22:08:08_560Z'
    };
    
                var s3bucket = new AWS.S3({
                params: {
                    Bucket: 'ml-runway'
                }
            });

    s3bucket.listObjectsV2(params, function(err, data) {
        if (err) {
            console.log(err);
        }
        else {
            var toWrite = '<!doctype html><html><head><title>S3 F$ Runway Photos (20)</title><meta name="F$ runway photos in S3; 20 most recent" content="S3"><meta charset="utf-8"></head><body>';
            // for (var i = 1; i < data.Contents.length + 1; i++) {
            for (var i = 1; i < 22; i++) {
                if (data.Contents[data.Contents.length - i].Key != 'index.html') {
                    toWrite = toWrite + "<img src='http://ml-runway.s3-website-us-east-1.amazonaws.com/" + data.Contents[data.Contents.length - i].Key + "'/>";
                }
            }
        }
        toWrite = toWrite + "</body></html>";
         s3bucket.upload({
             Key: 'test.html',
             Body: toWrite,
             ContentType: 'text/html'
         }, function(err, data) {
             if (err) {
                 console.log(err);
             }
             else {
                 // winston.info("uploaded new image: ", info.last_event.start_time);
             }
         });
        //fs.writeFileSync('test.html', toWrite)
    });

}

saveIndex();
