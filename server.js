require('dotenv-safe').config()
const { MONGO_URL } = process.env
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 8888
let db

function connectToDatabase(mongoUrl) {
	return new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useUnifiedTopology: true,
				useNewUrlParser: true,
			},
			async (err, client) => {
				if (err) return reject(err)
				const database = client.db('ovr')
				resolve(database)
			}
		)
	})
}

async function start() {
	try {
		db = await connectToDatabase(MONGO_URL)
	} catch (e) {
		console.log('Error connecting to mongodb', e)
		process.exit(1)
	}
	app.listen(port, '0.0.0.0', () => {
		console.log(`> Listening on localhost:${port}`)
	})
}

function error(res, msg) {
	return res.json({
		ok: false,
		msg,
	})
}

app.set('view engine', 'ejs')
app.use(bodyParser.json())
app.use('/assets', express.static('assets'))
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
	session({
		secret: 'example-random-secret',
		store: new MongoStore({
			url: MONGO_URL,
		}),
		cookie: {
			maxAge: 365 * 24 * 60 * 60 * 1000, // One year
		},
		resave: true,
		unset: 'destroy',
		saveUninitialized: true,
	})
)

app.use('*', (req, res, next) => {
	// Logger
	let time = new Date()
	console.log(
		`${req.method} to ${
			req.originalUrl
		} at ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}`
	)
	next()
})

app.post('/api/list', async (req, res) => {
	const { list, title } = req.body
	let id
	if (!list || list.length === 0)
        return error(res, 'You need to send the contents to create a list')
    if (!title || title.length === 0)
		return error(res, 'You need to send a title to create a list')
	// Check that all items have a link associated with them
	for (let i = 0; i < list.length; i++) {
		const item = list[i]
		if (
			!item.description ||
			item.description.length === 0 ||
			!item.link ||
			item.link.length === 0
		) {
			return error(res, 'The list is not formatted properly')
		}
	}
	// Add the list to the database
	try {
		const result = await db.collection('lists').insertOne({ 
            list: list,
            title: title,
        })
		id = result.insertedId
	} catch (e) {
		console.log('Error', e)
		return error(res, 'Error storing the list on the database')
	}
	// Generate the unique link for the page
	res.json({
		ok: true,
		id,
	})
})

app.get('/i/:listid', async (req, res) => {
    console.log('id', req.params.listid)
	const foundList = await db
		.collection('lists')
		.findOne({ _id: ObjectId(req.params.listid) })
    if (!foundList) return error(res, 'List not found for that id')
    
	return res.render('list', {
        list: foundList.list,
        title: foundList.title,
	})
})

app.get('/', (req, res) => {
	res.json({
		ok: true,
	})
})

start()
