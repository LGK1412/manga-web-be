const { MongoClient } = require('mongodb');

const genres = [
    "Action",
    "Adventure", 
    "Comedy",
    "Drama",
    "Fantasy",
    "Horror",
    "Romance",
    "Sci-Fi",
    "Mystery",
    "Thriller",
    "Slice of Life",
    "Supernatural",
    "Historical",
    "Sports",
    "Mecha",
    "Psychological",
    "Shounen",
    "Shoujo",
    "Seinen",
    "Josei"
];

async function seedGenres() {
    const client = new MongoClient(process.env.DATABASE_URL || 'mongodb://localhost:27017/manga-web');
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db();
        const collection = db.collection('genres');
        
        // Xóa tất cả genres cũ
        await collection.deleteMany({});
        console.log('Cleared existing genres');
        
        // Thêm genres mới
        const genreDocs = genres.map(name => ({ name }));
        const result = await collection.insertMany(genreDocs);
        console.log(`Inserted ${result.insertedCount} genres`);
        
        // Hiển thị kết quả
        const allGenres = await collection.find({}).toArray();
        console.log('All genres:', allGenres);
        
    } catch (error) {
        console.error('Error seeding genres:', error);
    } finally {
        await client.close();
        console.log('Disconnected from MongoDB');
    }
}

seedGenres();
