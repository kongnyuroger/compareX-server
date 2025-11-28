export const MOCK_PRODUCTS = [
	{
		id: 1,
		name: "Apple iPhone 13 Case",
		price: 19.99,
		tag: "Best Deal",
		tagColor: "bg-green-100 text-green-700",
		image:
			"https://www.digicape.co.za/image/cache/catalog/product/iphone13_silicone_case/iPhone_13_Starlight_Product_RED_Silicone_Case_with_MagSafe_Pure_Back_Screen__USEN-1000x1000.jpg", // Placeholder for iPhone 13 Case (Green)
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
			"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQp0frZ-jb7zKkbZx40gW31D5KDTdA89h83Gg&s",
		stores: ["amazon", "jumia"],
		category: "phone",
	},
	{
		id: 3,
		name: "Apple iPhone 11",
		price: 21.5,
		tag: "50+ results found",
		tagColor: "text-gray-600",
		image:
			"https://i5.walmartimages.com/seo/iPhone-11-64GB-Black-Unlocked-Refurbished-Good_64f9fc2a-254e-4530-8c78-797648608454_1.6f0da59e3c1b49bc082882e0737e6e19.jpeg", // Placeholder for iPhone 11
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
		image: "https://m.media-amazon.com/images/I/71nP6lTogjL._AC_SL1500_.jpg",
		stores: ["amazon", "walmart"],
		category: "Laptops",
	},
	{
		id: 5,
		name: "MacBook Air M1",
		price: 899.99,
		tag: "Best Value",
		tagColor: "bg-yellow-100 text-yellow-700",
		image:
			"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-g6ZWExP8t8Xl2bG0E4cM4mxjJYZ525ZrLQ&s",
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
		image:
			"https://m.media-amazon.com/images/I/61UgZSYRllL._AC_UF894,1000_QL80_.jpg",
		stores: ["ebay", "walmart"],
		category: "heardphones",
	},
	{
		id: 7,
		name: "AirPods Pro 2",
		price: 249.99,
		tag: "Top Rated",
		tagColor: "bg-green-100 text-green-700",
		image:
			"https://www.apple.com/v/airpods-pro/r/images/overview/welcome/hero__b0eal3mn03ua_large.jpg",
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
		image:
			"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT_7AaNNNMdVtNXMCCRxQZ0f8vVlD9JJtjT3g&s",
		stores: ["jumia", "ebay"],
		category: "smartwatches",
	},
	{
		id: 9,
		name: "Samsung Galaxy Watch 6",
		price: 289.99,
		tag: "Best Deal",
		tagColor: "bg-green-100 text-green-700",
		image:
			"https://fonexpress.net/wp-content/uploads/2023/09/WATCH-6-44MM-jpg.webp",
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
		image: "hhttps://m.media-amazon.com/images/I/71mTLn1iYML.jpg",
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
		image: "https://m.media-amazon.com/images/I/61IIJGmdmnL._SL1500_.jpg",
		stores: ["amazon", "walmart"],
	},
	{
		id: 12,
		name: "Xbox Series X Console",
		price: 499.99,
		tag: "Limited Stock",
		tagColor: "bg-orange-100 text-orange-700",
		image:
			"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqpxDPUJAs9Czjr_cxhPgMBpyw0Hl7jErGGw&s",
		stores: ["ebay", "jumia"],
	},

	// Home & Kitchen
	{
		id: 13,
		name: "Electric Kettle",
		price: 29.99,
		tag: "Best Seller",
		tagColor: "bg-green-100 text-green-700",
		image: "https://m.media-amazon.com/images/I/615mdbIlDpL._AC_SL1500_.jpg",
		stores: ["amazon", "jumia"],
		category: "kitchen",
	},
	{
		id: 14,
		name: "Air Fryer XL",
		price: 89.99,
		tag: "Recommended",
		tagColor: "bg-teal-100 text-teal-700",
		image:
			"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQC20U9snjdIZBjclaMdAzzL89nYgwdN1eRiQ&s",
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
		image:
			"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_me9JVf1duEXG6OCdsumbYf4ZvReMjFU2mw&s",
		stores: ["amazon", "ebay"],
		category: "computer",
	},
	{
		id: 16,
		name: "Keychron K2 Mechanical Keyboard",
		price: 89.99,
		tag: "Best Deal",
		tagColor: "bg-green-100 text-green-700",
		image:
			"https://www.keychron.uk/cdn/shop/products/Keychron-K2-wireless-mechanical-keyboard-for-Mac-Windows-iOS-Gateron-switch-brown-with-type-C-RGB-white-backlight_53059406-af50-40d8-8566-c3b5f1e85a62.jpg?v=1750434368&width=1214", // Random image for Keyboard
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
		image:
			"https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/2e4a0c14-0f3a-42f8-8669-ac33ad9e21a8/NIKE+VOMERO+PLUS.png",
		stores: ["amazon", "ebay"],
		category: "fashion",
	},
	{
		id: 18,
		name: "Women's Handbag",
		price: 39.99,
		tag: "Trending",
		tagColor: "bg-pink-100 text-pink-700",
		image: "https://m.media-amazon.com/images/I/61HT0mDzOWL.jpg",
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
		image:
			"https://cdn11.bigcommerce.com/s-3fd3md1ghs/images/stencil/1280x1280/products/36595/22467/100wcable__97235.1741863406.jpg?c=2",
		stores: ["amazon", "ebay"],
		category: "accessories",
	},
	{
		id: 20,
		name: "Portable Power Bank 20,000mAh",
		price: 24.99,
		tag: "Top Rated",
		tagColor: "bg-purple-100 text-purple-700",
		image:
			"https://www.sbsmobile.com/cdn/shop/files/TTBB20000PD45WK_PAN_1.jpg?v=1755058543&width=2048",
		stores: ["amazon", "jumia"],
		category: "accessories",
	},
];
