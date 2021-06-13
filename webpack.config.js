const path                 = require('path');
const webpack              = require('webpack');
const HtmlWebpackPlugin    = require('html-webpack-plugin');
const CopyWebpackPlugin    = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
	entry: path.join(__dirname, 'src', 'index.ts'),
	mode: "development",
	devtool: "eval-source-map",

	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js'
	},

	module: {
		rules: [
			{ test: /\.css$/, use: [ MiniCssExtractPlugin.loader, 'css-loader' ] },
			{ test: /\.ts$/,  use: 'ts-loader', exclude: /node_modules/ }
		]
	},

	resolve: {
		extensions: ['.ts', '.js']
	},

	plugins: [
		new HtmlWebpackPlugin({
			template: 'src/index.html',
		}),

		new CopyWebpackPlugin({
			patterns: [{
				from: 'static'
			}]
		}),

		new MiniCssExtractPlugin()
	]
};
