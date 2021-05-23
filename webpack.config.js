const path              = require('path');
const webpack           = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: path.join(__dirname, 'src', 'index.js'),
	mode: "development",

	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js'
	},

	module: {
		rules: [
			{ test: /\.css$/, use: [ 'style-loader', 'css-loader' ] }
		]
	},

	plugins: [
		new HtmlWebpackPlugin({
			template: 'src/index.html',
		}),

		new CopyWebpackPlugin({
			patterns: [{
				from: 'static'
			}]
		})
	]
};
