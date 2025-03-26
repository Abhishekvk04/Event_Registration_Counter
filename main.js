const WebSocket = require('ws');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class MongoDBWebSocketServer {
    constructor(port = 8080) {
        this.port = port;
        this.mongoClient = null;
        this.db = null;
        this.wss = null;
    }

    async connect() {
        try {
            // MongoDB Atlas connection string
            const ATLAS_URI = process.env.MONGODB_ATLAS_URI;

            // Connect to MongoDB Atlas
            this.mongoClient = new MongoClient(ATLAS_URI, { 
                useNewUrlParser: true, 
                useUnifiedTopology: true 
            });
            await this.mongoClient.connect();
            
            // Select the database
            const DB_NAME = process.env.DB_NAME || 'aavishkar25';
            this.db = this.mongoClient.db(DB_NAME);
            console.log('Connected to MongoDB Atlas successfully');

            // Create WebSocket server
            this.wss = new WebSocket.Server({ port: this.port });
            
            // Set up WebSocket connection handler
            this.wss.on('connection', (ws) => {
                console.log('New WebSocket connection');

                ws.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        
                        // Handle different request types
                        if (data.type === 'getEvents') {
                            const events = await this.getEventsList();
                            ws.send(JSON.stringify({
                                type: 'eventsList',
                                events: events
                            }));
                        } else if (data.type === 'getEventCount' && data.eventId) {
                            const count = await this.getEventCount(data.eventId);
                            ws.send(JSON.stringify({
                                type: 'eventCount',
                                eventId: data.eventId,
                                count: count
                            }));
                        } else if (data.type === 'getTotalCount') {
                            const count = await this.getTotalCount();
                            ws.send(JSON.stringify({
                                type: 'totalCount',
                                count: count
                            }));
                        } else {
                            ws.send(JSON.stringify({
                                error: 'Invalid request'
                            }));
                        }
                    } catch (error) {
                        console.error('Error processing message:', error);
                        ws.send(JSON.stringify({
                            error: 'Error processing your request',
                            details: error.message
                        }));
                    }
                });

                ws.on('close', () => {
                    console.log('WebSocket connection closed');
                });
            });

            console.log(`WebSocket server running on port ${this.port}`);
        } catch (error) {
            console.error('Initialization error:', error);
            process.exit(1);
        }
    }

    async getTotalCount() {
        try {
            // Count all documents in the 'teams' collection
            const teamsCollection = this.db.collection('teams');
            const count = await teamsCollection.countDocuments();
            console.log(`Counted ${count} teams in total`);

            return count;
        } catch (error) {
            console.error('Error counting total documents:', error);
            throw error;
        }
    }

    async getEventsList() {
        try {
            // Retrieve events with their _id and name
            const eventsCollection = this.db.collection('events');
            const events = await eventsCollection.find({}, {
                projection: { _id: 1, name: 1 }
            }).toArray();

            return events;
        } catch (error) {
            console.error('Error retrieving events:', error);
            throw error;
        }
    }

    async getEventCount(eventId) {
        try {
            // Find the specific event to confirm its existence
            const eventsCollection = this.db.collection('events');
            const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });

            if (!event) {
                throw new Error(`Event with ID ${eventId} not found`);
            }

            // Count documents in the collection matching the event ID
            const teamsCollection = this.db.collection('teams');
            const count = await teamsCollection.countDocuments({ 
                event: new ObjectId(eventId) 
            });
            console.log(`Counted ${count} teams for event ${eventId}`);

            return count;
        } catch (error) {
            console.error(`Error counting documents for event ${eventId}:`, error);
            throw error;
        }
    }

    async close() {
        if (this.wss) {
            this.wss.close();
        }
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
    }
}

// Start the server
async function startServer() {
    const server = new MongoDBWebSocketServer(8080);
    await server.connect();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('Shutting down server...');
        await server.close();
        process.exit(0);
    });
}

startServer().catch(console.error);