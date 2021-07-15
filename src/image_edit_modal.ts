import './interface.css';

import { ImpositionImage } from './imposition';
import     * as Imposition from './imposition';


interface ImagePropertiesFormControlsCollection extends HTMLFormControlsCollection {
	"name"          : HTMLInputElement;
	"page-spread"   : HTMLInputElement;
	"crease-margin" : HTMLInputElement;

	"delete" : HTMLButtonElement;
	"cancel" : HTMLButtonElement;
}


interface ImagePropertiesFormElement extends HTMLFormElement {
	properties_context : ImagePropertiesContext;
	elements: ImagePropertiesFormControlsCollection;
}


declare global {
	interface Window {
		image_properties_form : ImagePropertiesFormElement
	}
};


export class ImagePropertiesContext {
	image     : ImpositionImage;
	new_image : ImpositionImage;

	constructor (image : ImpositionImage) {
		this.image     = image;

		// Shallow copy image while retaining type
		this.new_image = Object.assign(new ImpositionImage(), image);
	}

	refreshFormValues (form : ImagePropertiesFormElement) {
		/*
			Set the form to display current values of the image.
		*/

		form.elements['name'].value = this.new_image.name;
		form.elements['page-spread'].checked = !this.new_image.is_single_page; 
		// form.elements['crease-margin'].value = this.image.crease_margin?.toString() ?? "";

		// Show form
		form.classList.remove("hidden");
		document.querySelector("#modal-container").classList.remove("hidden");
	}

	formSave (form: ImagePropertiesFormElement) {
		this.new_image.name           = form.elements['name'].value;
		this.new_image.is_single_page = !form.elements['page-spread'].checked;

		// if (form.elements['crease-margin'].value == "") {
		// 	this.new_image.crease_margin  = null;
		// }
		// else {
		// 	this.new_image.crease_margin  = parseInt(form.elements['crease-margin'].value);
		// }


		// If the page spread box was changed, create or modify new
		// elements for that page by triggering the ImpositionImage
		// onload hook

		if (this.image.is_single_page != this.new_image.is_single_page) {
			this.new_image.rebuildElements();
		}
	}

	bindForm (form : ImagePropertiesFormElement) : Promise<ImpositionImage> {
		// Sync the form values with the images' current property values

		this.refreshFormValues(form);

		// Resolve the promise when the user submits or cancels the form

		return new Promise<ImpositionImage>( (resolve, reject) => {
			form.onsubmit = (e : Event) => {
				e.preventDefault();

				this.formSave(form);
				
				// Close modal

				form.classList.add("hidden");
				document.querySelector("#modal-container").classList.add("hidden");

				resolve(this.new_image);
			};

			form.elements['delete'].onclick = (e) => {
				e.preventDefault();
				form.classList.add("hidden");
				document.querySelector("#modal-container").classList.add("hidden");
				resolve(null);
			};

			form.elements['cancel'].onclick = (e) => {
				e.preventDefault();
				form.classList.add("hidden");
				document.querySelector("#modal-container").classList.add("hidden");
				reject("FORM_CANCELLED");
			}
		});
	}

	static editorForm (image : ImpositionImage) : Promise<ImpositionImage> {
		const context = new ImagePropertiesContext(image);
		const editor_promise = context.bindForm(window.image_properties_form);
		return editor_promise;
	}
}

function imagePropertiesModalOpen () {}

// Initialize image edit modal on page load

window.addEventListener("load", () => {
	const form = <ImagePropertiesFormElement> document.getElementById("image-edit-form");

	window.image_properties_form = form;
});
