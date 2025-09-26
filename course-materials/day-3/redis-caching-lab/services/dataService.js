const cacheService = require('./cacheService');

class DataService {
  constructor() {
    this.simulateDelay = true;
    this.failureRate = 0.1; // 10% chance of simulated failure
  }

  /**
   * Simulate network delay
   * @param {number} min - Minimum delay in ms
   * @param {number} max - Maximum delay in ms
   */
  async delay(min = 100, max = 2000) {
    if (this.simulateDelay) {
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Simulate random failures
   */
  simulateFailure() {
    if (Math.random() < this.failureRate) {
      throw new Error('Simulated external API failure');
    }
  }

  /**
   * Fetch news articles from simulated external API
   * @param {string} category - News category
   * @param {number} limit - Number of articles
   * @returns {Promise<Array>} News articles
   */
  async fetchNewsArticles(category = 'general', limit = 10) {
    console.log(
      `📰 Fetching news articles: category=${category}, limit=${limit}`
    );

    // Simulate API delay
    await this.delay(500, 1500);

    // Simulate occasional failures
    this.simulateFailure();

    const categories = [
      'general',
      'technology',
      'business',
      'sports',
      'entertainment',
    ];
    const sources = ['NewsAPI', 'Reuters', 'BBC', 'CNN', 'TechCrunch'];

    const articles = [];

    for (let i = 0; i < limit; i++) {
      articles.push({
        id: `article_${category}_${Date.now()}_${i}`,
        title: this.generateNewsTitle(category),
        description: this.generateNewsDescription(category),
        content: this.generateNewsContent(category),
        author: this.generateAuthorName(),
        source: sources[Math.floor(Math.random() * sources.length)],
        category: category,
        publishedAt: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        url: `https://example.com/news/${category}/${i}`,
        imageUrl: `https://picsum.photos/400/300?random=${Date.now() + i}`,
        readTime: Math.floor(Math.random() * 10) + 2,
        tags: this.generateTags(category),
      });
    }

    return {
      articles,
      category,
      totalResults: limit,
      fetchedAt: new Date().toISOString(),
      source: 'External News API',
    };
  }

  /**
   * Fetch user profile from simulated database
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async fetchUserProfile(userId) {
    console.log(`👤 Fetching user profile: ${userId}`);

    // Simulate database query delay
    await this.delay(200, 800);

    // Simulate occasional failures
    this.simulateFailure();

    return {
      id: userId,
      username: `user_${userId}`,
      email: `user${userId}@example.com`,
      profile: {
        firstName: this.generateFirstName(),
        lastName: this.generateLastName(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        bio: this.generateBio(),
        location: this.generateLocation(),
        website: `https://${userId}.example.com`,
        joinedAt: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      stats: {
        followers: Math.floor(Math.random() * 10000),
        following: Math.floor(Math.random() * 1000),
        posts: Math.floor(Math.random() * 500),
        likes: Math.floor(Math.random() * 50000),
      },
      preferences: {
        theme: Math.random() > 0.5 ? 'dark' : 'light',
        notifications: Math.random() > 0.3,
        privacy: Math.random() > 0.7 ? 'private' : 'public',
      },
      lastSeen: new Date(
        Date.now() - Math.random() * 24 * 60 * 60 * 1000
      ).toISOString(),
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch weather data for a city
   * @param {string} city - City name
   * @returns {Promise<Object>} Weather data
   */
  async fetchWeatherData(city) {
    console.log(`🌤️  Fetching weather data for: ${city}`);

    // Simulate weather API delay
    await this.delay(300, 1000);

    // Simulate occasional failures
    this.simulateFailure();

    const conditions = ['sunny', 'cloudy', 'rainy', 'snowy', 'stormy', 'foggy'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];

    return {
      city: city.charAt(0).toUpperCase() + city.slice(1),
      country: this.getCountryForCity(city),
      current: {
        temperature: Math.floor(Math.random() * 40) - 10, // -10 to 30°C
        condition: condition,
        humidity: Math.floor(Math.random() * 100),
        windSpeed: Math.floor(Math.random() * 50),
        pressure: Math.floor(Math.random() * 200) + 900,
        visibility: Math.floor(Math.random() * 20) + 5,
        uvIndex: Math.floor(Math.random() * 11),
      },
      forecast: this.generateForecast(),
      fetchedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Valid for 10 minutes
    };
  }

  /**
   * Fetch product catalog with filtering and pagination
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Product catalog
   */
  async fetchProductCatalog(options = {}) {
    const {
      category = 'all',
      priceRange,
      sortBy = 'name',
      page = 1,
      limit = 20,
    } = options;

    console.log(`🛍️  Fetching product catalog: ${JSON.stringify(options)}`);

    // Simulate complex database query delay
    await this.delay(800, 2000);

    // Simulate occasional failures
    this.simulateFailure();

    const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
    const products = [];

    for (let i = 0; i < limit; i++) {
      const productCategory =
        category === 'all'
          ? categories[Math.floor(Math.random() * categories.length)]
          : category;

      products.push({
        id: `product_${productCategory}_${Date.now()}_${i}`,
        name: this.generateProductName(productCategory),
        description: this.generateProductDescription(productCategory),
        price: Math.floor(Math.random() * 500) + 10,
        category: productCategory,
        brand: this.generateBrandName(productCategory),
        rating: Math.floor(Math.random() * 50) / 10 + 1, // 1.0 to 5.0
        reviews: Math.floor(Math.random() * 1000),
        inStock: Math.random() > 0.1,
        imageUrl: `https://picsum.photos/300/300?random=${Date.now() + i}`,
        tags: this.generateProductTags(productCategory),
      });
    }

    return {
      products,
      pagination: {
        page,
        limit,
        total: Math.floor(Math.random() * 1000) + 100,
        pages: Math.ceil((Math.floor(Math.random() * 1000) + 100) / limit),
      },
      filters: options,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Heavy computation simulation (e.g., analytics, reports)
   * @param {string} reportType - Type of report
   * @returns {Promise<Object>} Report data
   */
  async generateReport(reportType = 'sales') {
    console.log(`📊 Generating ${reportType} report (heavy computation)...`);

    // Simulate heavy computation delay
    await this.delay(2000, 5000);

    // Simulate occasional failures
    this.simulateFailure();

    const data = [];
    const labels = [];

    // Generate sample data points
    for (let i = 0; i < 12; i++) {
      data.push(Math.floor(Math.random() * 100000));
      labels.push(
        new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' })
      );
    }

    return {
      reportType,
      title: `${
        reportType.charAt(0).toUpperCase() + reportType.slice(1)
      } Report`,
      data,
      labels,
      summary: {
        total: data.reduce((sum, val) => sum + val, 0),
        average: Math.round(
          data.reduce((sum, val) => sum + val, 0) / data.length
        ),
        growth: (Math.random() * 20 - 10).toFixed(2) + '%', // -10% to +10%
        trend: Math.random() > 0.5 ? 'up' : 'down',
      },
      generatedAt: new Date().toISOString(),
      computationTime: Math.floor(Math.random() * 3000) + 2000, // 2-5 seconds
    };
  }

  // Helper methods for generating realistic data

  generateNewsTitle(category) {
    const templates = {
      general: ['Breaking News: {}', 'Latest Update: {}', 'Important: {}'],
      technology: ['Tech Innovation: {}', 'New Release: {}', 'Tech News: {}'],
      business: [
        'Market Update: {}',
        'Business News: {}',
        'Economic Report: {}',
      ],
      sports: ['Sports Update: {}', 'Game Recap: {}', 'Athletic News: {}'],
      entertainment: [
        'Entertainment: {}',
        'Celebrity News: {}',
        'Show Review: {}',
      ],
    };

    const topics = {
      general: ['Major Development', 'Policy Change', 'Community Event'],
      technology: ['AI Breakthrough', 'Software Update', 'New Gadget'],
      business: ['Stock Market', 'Company Merger', 'Economic Growth'],
      sports: ['Championship Game', 'Player Trade', 'Season Highlights'],
      entertainment: ['Movie Release', 'Concert Tour', 'Award Show'],
    };

    const template =
      templates[category][
        Math.floor(Math.random() * templates[category].length)
      ];
    const topic =
      topics[category][Math.floor(Math.random() * topics[category].length)];

    return template.replace('{}', topic);
  }

  generateNewsDescription(category) {
    const descriptions = [
      'This is a detailed description of the latest news story.',
      'Breaking developments continue to unfold in this ongoing story.',
      'Experts weigh in on the implications of this significant event.',
      'Local and national impact expected from this important news.',
      'Stay tuned for more updates as this story develops.',
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  generateNewsContent(category) {
    return (
      `This is the full content of the ${category} news article. ` +
      'It contains detailed information about the story, quotes from sources, ' +
      'and comprehensive coverage of the event. The article provides context ' +
      'and analysis to help readers understand the significance of the news.'
    );
  }

  generateAuthorName() {
    const firstNames = [
      'John',
      'Jane',
      'Mike',
      'Sarah',
      'David',
      'Emily',
      'Chris',
      'Lisa',
    ];
    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
    ];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    return `${firstName} ${lastName}`;
  }

  generateTags(category) {
    const tagGroups = {
      general: ['news', 'breaking', 'update', 'important'],
      technology: ['tech', 'innovation', 'digital', 'software'],
      business: ['business', 'finance', 'market', 'economy'],
      sports: ['sports', 'game', 'team', 'player'],
      entertainment: ['entertainment', 'celebrity', 'movie', 'music'],
    };

    const tags = tagGroups[category] || tagGroups.general;
    return tags.slice(0, Math.floor(Math.random() * 3) + 2);
  }

  generateFirstName() {
    const names = [
      'Alex',
      'Jordan',
      'Taylor',
      'Casey',
      'Morgan',
      'Riley',
      'Avery',
      'Quinn',
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  generateLastName() {
    const names = [
      'Anderson',
      'Thompson',
      'Wilson',
      'Moore',
      'Taylor',
      'Clark',
      'Lewis',
      'Walker',
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  generateBio() {
    const bios = [
      'Software developer passionate about technology and innovation.',
      'Creative professional with a love for design and user experience.',
      'Entrepreneur building the next generation of digital solutions.',
      'Student exploring the intersection of technology and society.',
      'Freelance consultant helping businesses grow through technology.',
    ];
    return bios[Math.floor(Math.random() * bios.length)];
  }

  generateLocation() {
    const locations = [
      'New York, NY',
      'San Francisco, CA',
      'Austin, TX',
      'Seattle, WA',
      'Chicago, IL',
      'Boston, MA',
    ];
    return locations[Math.floor(Math.random() * locations.length)];
  }

  getCountryForCity(city) {
    const cityCountryMap = {
      london: 'United Kingdom',
      paris: 'France',
      tokyo: 'Japan',
      newyork: 'United States',
      sydney: 'Australia',
      toronto: 'Canada',
    };
    return cityCountryMap[city.toLowerCase()] || 'Unknown';
  }

  generateForecast() {
    const forecast = [];
    for (let i = 1; i <= 5; i++) {
      forecast.push({
        day: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString(
          'en-US',
          { weekday: 'short' }
        ),
        high: Math.floor(Math.random() * 35) - 5,
        low: Math.floor(Math.random() * 20) - 10,
        condition: ['sunny', 'cloudy', 'rainy', 'snowy'][
          Math.floor(Math.random() * 4)
        ],
      });
    }
    return forecast;
  }

  generateProductName(category) {
    const names = {
      electronics: [
        'Smartphone Pro',
        'Laptop Ultra',
        'Tablet Max',
        'Headphones Elite',
      ],
      clothing: [
        'Premium Jacket',
        'Casual Shirt',
        'Designer Jeans',
        'Comfortable Sneakers',
      ],
      books: [
        'Programming Guide',
        'Fiction Novel',
        'Technical Manual',
        'Biography',
      ],
      home: [
        'Modern Lamp',
        'Comfortable Chair',
        'Kitchen Set',
        'Decorative Vase',
      ],
      sports: ['Running Shoes', 'Fitness Tracker', 'Yoga Mat', 'Sports Bottle'],
    };

    const categoryNames = names[category] || names.electronics;
    return categoryNames[Math.floor(Math.random() * categoryNames.length)];
  }

  generateProductDescription(category) {
    return (
      `High-quality ${category} product with excellent features and great value. ` +
      'Perfect for everyday use with modern design and reliable performance.'
    );
  }

  generateBrandName(category) {
    const brands = {
      electronics: ['TechCorp', 'InnovateTech', 'DigitalPro', 'SmartDevice'],
      clothing: ['StyleBrand', 'FashionCorp', 'TrendWear', 'ClassicStyle'],
      books: ['BookPublisher', 'ReadMore', 'KnowledgePress', 'WisdomBooks'],
      home: ['HomeBrand', 'ComfortLiving', 'ModernHome', 'StyleHome'],
      sports: ['SportsPro', 'ActiveWear', 'FitnessBrand', 'AthleticGear'],
    };

    const categoryBrands = brands[category] || brands.electronics;
    return categoryBrands[Math.floor(Math.random() * categoryBrands.length)];
  }

  generateProductTags(category) {
    const tags = {
      electronics: ['tech', 'gadget', 'smart', 'digital'],
      clothing: ['fashion', 'style', 'comfortable', 'trendy'],
      books: ['knowledge', 'learning', 'educational', 'informative'],
      home: ['home', 'decor', 'modern', 'functional'],
      sports: ['fitness', 'active', 'health', 'exercise'],
    };

    return tags[category] || tags.electronics;
  }
}

module.exports = new DataService();
