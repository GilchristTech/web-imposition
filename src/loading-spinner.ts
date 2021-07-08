interface SpinnerRingElement extends HTMLElement {
	spinner_context : Spinner;
};

export class Spinner {
	ring_element       : HTMLElement | null;
	num_tasks          :             number;

	constructor (element : HTMLElement | string | null = null ) {
		// Interpret constructor element argument
		
		if (element === null) {
			// If no argument is provided, create a new HTML element
			
			this.ring_element = document.createElement("div");
			this.ring_element.classList.add("spinner-ring");
		}
		else if (typeof element === "string") {
			// If the element is provided as a string, interpret it as a CSS query
			
			this.ring_element = document.querySelector(<string> element);
			
			// Error if the element is not found
			
			if (this.ring_element === null) {
				throw Error(`Could not find an element from the selector: ${element}`);
			}
		}
		else {
			// The element is an HTMLElement, just copy it
			this.ring_element = element;
		}

		this.ring_element.classList.add("spinner-ring");
		this.num_tasks = 0;
	}

	task (promise : Promise<any>) : Promise<any> {
		this.num_tasks++;
		this.ring_element.classList.remove("hidden");

		return promise.then( () => {
			this.num_tasks--;
			
			if (this.num_tasks <= 0) {
				this.ring_element.classList.add("hidden");
			}
		});
	}
};
