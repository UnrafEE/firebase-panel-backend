const express = require('express'),
    app = express(),
    port = parseInt(process.env.PORT, 10) || 8080,
    cors = require('cors'),
    admin = require('firebase-admin'),
    fs = require('fs'),
    multer = require('multer'),
    cookieParser = require('cookie-parser');


admin.initializeApp({
    credential: admin.credential.cert('./gterenowa-firebase-adminsdk-8j2eo-a35fd741f5.json'),
    databaseURL: "https://gterenowa.firebaseio.com"
});

var db = admin.database().ref('zadanie');
var corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

const verifyUser = (req, res, next) => {
    const sessionCookie = req.cookies.session || '';
    // Verify the session cookie. In this case an additional check is added to detect
    // if the user's Firebase session was revoked, user deleted/disabled, etc.
    admin.auth().verifySessionCookie(
        sessionCookie, true /** checkRevoked */)
        .then((decodedClaims) => {
            // user authenticated with successfull result
            next()
        })
        .catch(error => {
            // Session cookie is unavailable or invalid. Force user to login.
            res.status(401).send('err credentials')
        });
}

//4 jsons
app.use(express.json())
//4 forms
app.use(express.urlencoded({ extended: true }))
app.use(cors(corsOptions))
app.use(cookieParser())

app.listen(port, () => {
    console.log('listening on port ' + port)
})

app.post('/sessionLogin', (req, res) => {
    const idToken = req.body.idToken.toString();

    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    admin.auth().createSessionCookie(idToken, { expiresIn })
        .then((sessionCookie) => {
            // Set cookie policy for session cookie.
            const options = { maxAge: expiresIn, httpOnly: true, secured: true };
            res.cookie('session', sessionCookie, options);
            res.end(JSON.stringify({ status: 'success' }));
        }, error => {
            res.status(401).send('UNAUTHORIZED REQUEST!');
        });
})

app.post('/sessionLogout', (req, res) => {
    res.clearCookie('session');
    res.redirect('/login');
});

app.post('/message', (req, res) => {
    const sessionCookie = req.cookies.session || '';
    admin.auth().verifySessionCookie(
        sessionCookie, true /** checkRevoked */)
        .then((decodedClaims) => {
            sendMessage(req.body.title, req.body.message)
                .then(response => {
                    res.send('successfully send notif.. ' + response)
                })
                .catch(error => {
                    res.send('error occurred' + error)
                })
        })
        .catch(error => {
            // Session cookie is unavailable or invalid. Force user to login.
            res.status(401).send('error occurred' + error)
        });
})

app.post('/getDB', verifyUser, (req, res) => {
    db.on('value', function (snapshot) {
        res.status(200).send(snapshot.val())
        db.off("value");
    })
})
// var upload = multer({
//     dest: 'uploads/',
// })
var bucket = admin.storage().bucket('gterenowa.appspot.com')
// console.log(bucket)

var upload = multer({ dest: 'uploads/', })
// var upload = multer({ storage: multer.memoryStorage() })
app.post('/submitForm', verifyUser, upload.single('image'), (req, res) => {
    if (req.file) {
        if (req.file.mimetype.includes('image/')) {
            const options = {
                destination: "cc." + "jpg",
                resumable: true,
                validation: 'crc32c',
                metadata: {
                    contentType: req.file.mimetype,
                }
            };
            bucket.upload('uploads/' + req.file.filename, options, function (err, file) {
                if (err)
                    res.status(422).send(err)
                console.log('Uploaded a blob or file!');
                fs.unlink('uploads/' + req.file.filename, function (err) {
                    if (err) throw err;
                    console.log('File deleted!');
                });
            });
            res.status(200).send('Wysłano pomyślnie')
        }
        else {
            res.status(422).send('Nieprawidlowy format. Musi byc obrazek')
        }
    } else {
        res.status(200).send('Wysłano pomyślnie bez obrazka')

    }


})

app.post('/checkLogged', verifyUser, (req, res) => {
    res.status(200).send('logged in successfully')
})

const sendMessage = (title, message) => {
    let content = {
        data: {
            message: message,
            title: title
        },
        topic: 'graTerenowaNotificationsService'
    }
    return admin.messaging().send(content)
}
