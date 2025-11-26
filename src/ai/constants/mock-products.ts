export const MOCK_PRODUCTS = [
	{
		id: 1,
		name: "Apple iPhone 13 Case",
		price: 19.99,
		tag: "Best Deal",
		tagColor: "bg-green-100 text-green-700",
		image:
			"https://via.placeholder.com/300x300/6B8E23/FFFFFF?text=Green+iPhone+Case", // Placeholder for iPhone 13 Case (Green)
		stores: ["jumia", "ebay"],
		category: "phone",
	},
	{
		id: 2,
		name: "Apple iPhone 13 Case",
		price: 20.99,
		tag: "Cheapest",
		tagColor: "bg-blue-100 text-blue-700",
		image:
			"https://via.placeholder.com/300x300/4682B4/FFFFFF?text=Blue+iPhone+Case", // Placeholder for iPhone 13 Case (Blue)
		stores: ["amazon", "jumia"],
		category: "phone",
	},
	{
		id: 3,
		name: "Apple iPhone 11",
		price: 21.5,
		tag: "50+ results found",
		tagColor: "text-gray-600",
		image: "https://via.placeholder.com/300x300/808080/FFFFFF?text=iPhone+11", // Placeholder for iPhone 11
		stores: ["walmart", "ebay"],
		category: "phone",
	},
	// Laptops
	{
		id: 4,
		name: "Dell Inspiron 15",
		price: 549.99,
		tag: "Popular",
		tagColor: "bg-purple-100 text-purple-700",
		image: "https://picsum.photos/seed/dell-inspiron/300/300", // Random image for Dell Inspiron
		stores: ["amazon", "walmart"],
		category: "Laptops",
	},
	{
		id: 5,
		name: "MacBook Air M1",
		price: 899.99,
		tag: "Best Value",
		tagColor: "bg-yellow-100 text-yellow-700",
		image: "https://picsum.photos/seed/macbook-air/300/300", // Random image for MacBook Air
		stores: ["jumia", "amazon"],
		category: "Laptops",
	},

	// Headphones
	{
		id: 6,
		name: "Sony WH-1000XM4",
		price: 299.99,
		tag: "Trending",
		tagColor: "bg-red-100 text-red-700",
		image: "https://picsum.photos/seed/sony-headphones/300/300", // Random image for Sony Headphones
		stores: ["ebay", "walmart"],
		category: "heardphones",
	},
	{
		id: 7,
		name: "AirPods Pro 2",
		price: 249.99,
		tag: "Top Rated",
		tagColor: "bg-green-100 text-green-700",
		image: "https://picsum.photos/seed/airpods-pro/300/300", // Random image for AirPods Pro
		stores: ["amazon", "jumia"],
		category: "heardphones",
	},

	// Smartwatches
	{
		id: 8,
		name: "Apple Watch Series 9",
		price: 429.99,
		tag: "New",
		tagColor: "bg-blue-100 text-blue-700",
		image: "https://picsum.photos/seed/apple-watch/300/300", // Random image for Apple Watch
		stores: ["jumia", "ebay"],
		category: "smartwatches",
	},
	{
		id: 9,
		name: "Samsung Galaxy Watch 6",
		price: 289.99,
		tag: "Best Deal",
		tagColor: "bg-green-100 text-green-700",
		image: "https://picsum.photos/seed/galaxy-watch/300/300", // Random image for Samsung Galaxy Watch
		stores: ["amazon", "walmart"],
		category: "smartwatches",
	},

	// Cameras
	{
		id: 10,
		name: "Canon EOS M50",
		price: 649.99,
		tag: "Hot Sale",
		tagColor: "bg-red-100 text-red-700",
		image: "https://picsum.photos/seed/canon-m50/300/300", // Random image for Camera
		stores: ["amazon", "ebay"],
		category: "cameras",
	},

	// Gaming
	{
		id: 11,
		name: "PlayStation 5 Controller",
		price: 69.99,
		tag: "Top Pick",
		tagColor: "bg-indigo-100 text-indigo-700",
		image: "https://picsum.photos/seed/ps5-controller/300/300", // Random image for PS5 Controller
		stores: ["amazon", "walmart"],
	},
	{
		id: 12,
		name: "Xbox Series X Console",
		price: 499.99,
		tag: "Limited Stock",
		tagColor: "bg-orange-100 text-orange-700",
		image: "https://picsum.photos/seed/xbox-series-x/300/300", // Random image for Xbox Console
		stores: ["ebay", "jumia"],
	},

	// Home & Kitchen
	{
		id: 13,
		name: "Electric Kettle",
		price: 29.99,
		tag: "Best Seller",
		tagColor: "bg-green-100 text-green-700",
		image: "https://picsum.photos/seed/electric-kettle/300/300", // Random image for Kettle
		stores: ["amazon", "jumia"],
		category: "kitchen",
	},
	{
		id: 14,
		name: "Air Fryer XL",
		price: 89.99,
		tag: "Recommended",
		tagColor: "bg-teal-100 text-teal-700",
		image: "https://picsum.photos/seed/air-fryer/300/300", // Random image for Air Fryer
		stores: ["walmart", "amazon"],
		category: "kitchen",
	},

	// Computer Accessories
	{
		id: 15,
		name: "Logitech MX Master 3 Mouse",
		price: 99.99,
		tag: "Pro Choice",
		tagColor: "bg-gray-100 text-gray-700",
		image: "https://picsum.photos/seed/logitech-mouse/300/300", // Random image for Computer Mouse
		stores: ["amazon", "ebay"],
		category: "computer",
	},
	{
		id: 16,
		name: "Keychron K2 Mechanical Keyboard",
		price: 89.99,
		tag: "Best Deal",
		tagColor: "bg-green-100 text-green-700",
		image: "https://picsum.photos/seed/mechanical-keyboard/300/300", // Random image for Keyboard
		stores: ["jumia", "walmart"],
		category: "computer",
	},

	// Fashion
	{
		id: 17,
		name: "Men’s Running Shoes",
		price: 59.99,
		tag: "Hot Deal",
		tagColor: "bg-orange-100 text-orange-700",
		image: "https://picsum.photos/seed/running-shoes/300/300", // Random image for Running Shoes
		stores: ["amazon", "ebay"],
		category: "fashion",
	},
	{
		id: 18,
		name: "Women's Handbag",
		price: 39.99,
		tag: "Trending",
		tagColor: "bg-pink-100 text-pink-700",
		image: "https://picsum.photos/seed/womens-handbag/300/300", // Random image for Handbag
		stores: ["jumia", "walmart"],
		category: "fashion",
	},

	// Accessories
	{
		id: 19,
		name: "USB-C Fast Charging Cable",
		price: 9.99,
		tag: "Cheapest",
		tagColor: "bg-blue-100 text-blue-700",
		image: "https://picsum.photos/seed/usb-c-cable/300/300", // Random image for Charging Cable
		stores: ["amazon", "ebay"],
		category: "accessories",
	},
	{
		id: 20,
		name: "Portable Power Bank 20,000mAh",
		price: 24.99,
		tag: "Top Rated",
		tagColor: "bg-purple-100 text-purple-700",
		image: "https://picsum.photos/seed/power-bank/300/300", // Random image for Power Bank
		stores: ["amazon", "jumia"],
		category: "accessories",
	},
];
