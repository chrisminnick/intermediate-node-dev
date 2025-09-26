const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create sample data for the performance lab
function generateProducts(count = 10000) {
  const categories = [
    'Electronics',
    'Clothing',
    'Books',
    'Home & Garden',
    'Sports',
    'Automotive',
    'Health',
    'Beauty',
    'Toys',
    'Food',
  ];
  const products = [];

  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const product = {
      id: uuidv4(),
      name: `Product ${i + 1}`,
      description: `This is a detailed description for product ${
        i + 1
      }. It includes various features and benefits that make this product unique in the ${category.toLowerCase()} category.`,
      price: Math.floor(Math.random() * 1000) + 10,
      category,
      brand: `Brand ${Math.floor(Math.random() * 100) + 1}`,
      inStock: Math.random() > 0.1,
      quantity: Math.floor(Math.random() * 100),
      tags: generateTags(),
      createdAt: new Date(
        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    products.push(product);
  }

  return products;
}

function generateTags() {
  const allTags = [
    'popular',
    'new',
    'sale',
    'premium',
    'bestseller',
    'eco-friendly',
    'limited-edition',
    'handmade',
    'imported',
    'local',
  ];
  const numTags = Math.floor(Math.random() * 4) + 1;
  const tags = [];

  for (let i = 0; i < numTags; i++) {
    const tag = allTags[Math.floor(Math.random() * allTags.length)];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}

function generateUsers(count = 5000) {
  const users = [];

  for (let i = 0; i < count; i++) {
    const user = {
      id: uuidv4(),
      username: `user${i + 1}`,
      email: `user${i + 1}@example.com`,
      firstName: `FirstName${i + 1}`,
      lastName: `LastName${i + 1}`,
      createdAt: new Date(
        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      lastLoginAt: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      isActive: Math.random() > 0.1,
    };
    users.push(user);
  }

  return users;
}

function generateOrders(users, products, count = 50000) {
  const orders = [];

  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const numItems = Math.floor(Math.random() * 5) + 1;
    const items = [];
    let total = 0;

    for (let j = 0; j < numItems; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const price = product.price;
      const itemTotal = quantity * price;

      const item = {
        productId: product.id,
        quantity,
        price,
        total: itemTotal,
        rating: Math.random() > 0.3 ? Math.floor(Math.random() * 5) + 1 : null,
        review:
          Math.random() > 0.7 ? `Review for product ${product.name}` : null,
      };

      items.push(item);
      total += itemTotal;
    }

    const order = {
      id: uuidv4(),
      userId: user.id,
      items,
      total,
      status: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'][
        Math.floor(Math.random() * 5)
      ],
      createdAt: new Date(
        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orders.push(order);
  }

  return orders;
}

function main() {
  console.log('Generating sample data...');

  const dataDir = path.join(__dirname, '../data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Generate data
  console.log('Generating products...');
  const products = generateProducts(10000);

  console.log('Generating users...');
  const users = generateUsers(5000);

  console.log('Generating orders...');
  const orders = generateOrders(users, products, 50000);

  // Write data to files
  console.log('Writing products.json...');
  fs.writeFileSync(
    path.join(dataDir, 'products.json'),
    JSON.stringify(products, null, 2)
  );

  console.log('Writing users.json...');
  fs.writeFileSync(
    path.join(dataDir, 'users.json'),
    JSON.stringify(users, null, 2)
  );

  console.log('Writing orders.json...');
  fs.writeFileSync(
    path.join(dataDir, 'orders.json'),
    JSON.stringify(orders, null, 2)
  );

  console.log('Sample data generation complete!');
  console.log(
    `Generated ${products.length} products, ${users.length} users, ${orders.length} orders`
  );

  // Calculate file sizes
  const productSize = fs.statSync(path.join(dataDir, 'products.json')).size;
  const userSize = fs.statSync(path.join(dataDir, 'users.json')).size;
  const orderSize = fs.statSync(path.join(dataDir, 'orders.json')).size;

  console.log(`File sizes:`);
  console.log(`  products.json: ${(productSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  users.json: ${(userSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  orders.json: ${(orderSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `  Total: ${((productSize + userSize + orderSize) / 1024 / 1024).toFixed(
      2
    )} MB`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  generateProducts,
  generateUsers,
  generateOrders,
};
