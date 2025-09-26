const { parentPort, workerData } = require('worker_threads');

// CPU-intensive report generation in worker thread
function generateSalesReport(orders, products, startDate, endDate) {
  const report = {
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    topProducts: [],
    salesByCategory: {},
    dailySales: {},
    processedWith: 'worker-thread',
  };

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  // Create product lookup map
  const productMap = new Map();
  for (const product of products) {
    productMap.set(product.id, product);
  }

  // Process orders efficiently
  const categoryTotals = new Map();
  const productSales = new Map();
  const dailyTotals = new Map();

  for (const order of orders) {
    const orderTime = new Date(order.createdAt).getTime();

    if (orderTime >= startMs && orderTime <= endMs) {
      report.totalSales += order.total;
      report.totalOrders++;

      // Daily sales
      const dayKey = new Date(orderTime).toISOString().split('T')[0];
      dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + order.total);

      // Process items
      for (const item of order.items) {
        const product = productMap.get(item.productId);
        if (product) {
          const itemTotal = item.quantity * item.price;

          // Category sales
          const currentCategoryTotal =
            categoryTotals.get(product.category) || 0;
          categoryTotals.set(
            product.category,
            currentCategoryTotal + itemTotal
          );

          // Product sales
          const currentProductTotal = productSales.get(item.productId) || 0;
          productSales.set(item.productId, currentProductTotal + itemTotal);
        }
      }
    }
  }

  // Calculate average order value
  report.averageOrderValue =
    report.totalOrders > 0 ? report.totalSales / report.totalOrders : 0;

  // Convert maps to objects
  report.salesByCategory = Object.fromEntries(categoryTotals);
  report.dailySales = Object.fromEntries(dailyTotals);

  // Find top products
  const sortedProducts = Array.from(productSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([productId, sales]) => {
      const product = productMap.get(productId);
      return {
        productId,
        product: product ? product.name : 'Unknown',
        sales: Math.round(sales * 100) / 100,
      };
    });

  report.topProducts = sortedProducts;

  return report;
}

// Process the report generation
if (workerData) {
  try {
    const { orders, products, startDate, endDate } = workerData;
    const report = generateSalesReport(orders, products, startDate, endDate);
    parentPort.postMessage(report);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
}
