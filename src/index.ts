import * as JSZip from 'jszip';

function setMargin (margin: string) {
  document.documentElement.style.setProperty('--crease-margin-quantity', margin);
}

class ImpositionImage {
  /*
    Contains an image and image elements for an imposed page. If the page is
    full spread, two elements are created for each page in the spread.
  */

  src              :           string;  // image URL
  element          : HTMLImageElement;  // DOM element containing the image
  elementSecondary : HTMLImageElement;  // If the image is a two-page spread, the
                                        // second half of the image.
  is_single_page   :          boolean;
  hidden           :          boolean;

  constructor () {
    this.src              =  null;
    this.element          =  null;
    this.elementSecondary =  null;
    this.is_single_page   = false;
    this.hidden           = false;
  }

  onload (e: Event) {
    if (this.element.width > this.element.height) {
      this.element.className = "double";
      this.is_single_page = false;

      const right_img     = this.elementSecondary = document.createElement("img");
      right_img.src       = this.src;
      right_img.className = "double";
    }
    else {
      this.element.className = "single";
      this.is_single_page = true;
    }
  }
}


class ImpositionBook {
  images         : Array<ImpositionImage>;
  spreads        : Array<HTMLElement>;
  pages          : Array<HTMLElement>;
  real_pages     : HTMLElement;
  imposed_pages  : HTMLElement;
  right_to_left  : boolean;
  has_back_cover : boolean;


  constructor () {
    this.images        =    [];
    this.spreads       =  null;
    this.pages         =  null;
    
    // DOM elements containing individual page spreads
    this.real_pages    =  null;
    this.imposed_pages =  null;
    
    // Manga-order imposition flag
    this.right_to_left  = false;
    this.has_back_cover = true;
  }

  refresh () {
    /*
      Ensure that the DOM structure for the real page layout and imposed page
      layout views have all pages in this book, and are in the correct order.
    */

    this.refreshRealPageOrder();
    this.refreshImposedPageOrder();
  }

  refreshRealPageOrder () {
    /*
      Rebuild the parts of the DOM which contain page real-order layouts,
      reordering the booklet pages according to the order they are read.
    */

    this.real_pages.innerHTML = "";

    /*
      Go through each page source, and copy them into the real-order page flow,
      creating page spread elements
    */

    const spreads: Array<HTMLElement> = this.spreads = [];
    this.pages = [];

    // Keep track of which side of the spread the current page will be imposed
    // onto. This is a value of either zero or one, where zero is the first page
    // which should be read, and 1 is the second. Whether this is the left or
    // right side of the page is flipped by this.right_to_left, and this
    // determination can be turned into a string of "left" or "right" by
    // this.pageSideName(page_side)

    let page_side : boolean = true;

    for (let [images_key, image] of Object.entries(this.images)) {
      const images_i = parseInt(images_key);

      // If this is the back cover and we have the back cover enabled, break,
      // and don't generate it in this loop.
      if (this.has_back_cover && images_i == this.images.length - 1) {
	break;
      }

      let spread;

      if (image.is_single_page) {

	// Either create a new page spread, or use the previous one, depending
	// on which page_side of the spread we're on.

	if(spreads.length > 1 && page_side == true) {
	  spread = spreads[spreads.length-1];
	}
	else {
	  spread = this.createSpreadElement(`spread${spreads.length}`);
	  this.real_pages.appendChild(spread);
	  spreads.push(spread);
	}

	// Create new page element

	const page = this.createPageElement(page_side, `page${this.pages.length}`);
	page.appendChild(image.element);
	spread.appendChild(page);

	this.pages.push(page);

	// The next page will be on the opposide side of a spread
	page_side = !page_side;
      }
      else {
	// We're processing a one-image, double-page spread

	spread = this.createSpreadElement();
	this.real_pages.appendChild(spread);

	// Createa page element for each page in the spread, using different
	// sides of the same image.

	const page_l = document.createElement("div");
	const page_r = document.createElement("div");

	page_l.className = "spread-page spread-left";
	page_r.className = "spread-page spread-right";

	page_l.appendChild(image.element);
	page_r.appendChild(image.elementSecondary);

	spread.appendChild(page_l);
	spread.appendChild(page_r);

	page_l.id = `page${this.pages.length}`;
	page_r.id = `page${this.pages.length}`;

	this.pages.push(page_l);
	this.pages.push(page_r);

	// Because this image takes up a full page spread, start the next page
	// spread at the first page_side in the reading order.
	page_side = false;
      }
    }

    /*
      Append empty filler pages until the number of pages is divisible by four,
      also taking into account whether the final page image is used as a back
      cover.
    */
    
    // Calculate the total number of pages, after filler pages have been added

    let postfiller_page_length;

    if (this.has_back_cover) {
      postfiller_page_length = (
	((this.pages.length + 3) >> 2)   // # of sheets
	* 4                              // # of pages, rounded
	- 1                              // reserve back cover
      );
    }
    else {
      postfiller_page_length = (
	(                                // Fill extra pages until
		(this.pages.length + 4)  // back cover is blank.
		>> 2                     // From that, # of sheets
	) * 4                            // Round to # of pages
      );
    }

    // Insert blank pages to fill page count

    while (this.pages.length < postfiller_page_length) {
      // If the page number is even, then start a new page
      if (this.pages.length % 2 == 0) {
	const new_spread     = document.createElement("div");
	new_spread.className = "spread";
	this.spreads.push(new_spread);
	this.real_pages.appendChild(new_spread);
      }

      const spread           = this.spreads[this.spreads.length - 1];

      const blank_page = this.createPageElement(
	<any> (this.pages.length % 2),
	`page${this.pages.length}`
      );

      this.pages.push(blank_page);
      spread.appendChild(blank_page);
    }

    // If the back cover is the final page, insert that now

    if (this.has_back_cover) {
      const spread = this.createSpreadElement(
	`spread${this.spreads.length}`
      );

      this.spreads.push(spread);
      this.real_pages.appendChild(spread);

      const page = this.createPageElement(
	this.right_to_left,
	`pages${this.pages.length}`
      );

      page.appendChild(this.images[this.images.length - 1].element);
      spread.appendChild(page);
      this.pages.push(page);
    }
  }

  refreshImposedPageOrder () {
    this.imposed_pages.innerHTML = "";

    let last_sheet : HTMLElement = null;
    
    // Group groups of two spreads each into sheets, by mapping a function over
    // each spread.

    this.mapImposedSpreads( (spread : HTMLElement) => {
      let sheet = last_sheet;

      if (last_sheet === null) {
	const new_sheet = this.createSheetElement();
	this.imposed_pages.appendChild(new_sheet);
	sheet = new_sheet;
      }

      sheet.appendChild(spread)
      
      last_sheet = (last_sheet === null) ? sheet : null;
    });
  }
  
  imposedSliceSpreads (start : number, end : number) : Array<HTMLElement> {
    /*
      Return an array of page spreads, those from start to end, but reorded into
      an imposed section.
    */

    const imposed_spreads : Array<HTMLElement> = Array(this.pages.length >> 1);

    // This imposition algorithm iterates through the real order (that seen by
    // the reader) of page spreads, and uses that spread's index for
    // calculation.

    for (
	let imposed_spread_i = 0 ;
	imposed_spread_i < (end - start + 1) / 2 ;
	imposed_spread_i++
    ) {
      // Take one page index from both the front and back of the range of pages
      // we're imposing. Depending on whether we're on the front or back of this
      // sheet, these indices should be swapped.

      let  left_src_i  = end - start - 1 - imposed_spread_i;
      let right_src_i  = imposed_spread_i;

      if (imposed_spread_i % 2) {
	[left_src_i, right_src_i] = [right_src_i, left_src_i];
      }
  
      const  left_source_element  = this.pages[left_src_i];
      const right_source_element  = this.pages[right_src_i];
 
      // Create an element for the imposed page spread, to be added to the
      // return element.

      const imposed_spread_element = this.createSpreadElement();

      // Deep copy page sources

      if (left_source_element) {
	imposed_spread_element.appendChild(
	  left_source_element.cloneNode(true)
	);
      }

      if (right_source_element) {
	imposed_spread_element.appendChild(
	  right_source_element.cloneNode(true)
	);
      }

      imposed_spreads[imposed_spread_i] = imposed_spread_element;
    }

    return imposed_spreads;
  }

  mapImposedSpreads (start : (number|Function), end? : (number|Function), func? : Function) {
    /*
      Map a function over a slice in the real_pages array, but in imposed order
      instead of real order. The start and end arguments are optional, and
      default to the start and end of this.real_pages
    */

    // Process which arguments have been provided

    switch (arguments.length) {
      case 1: [ func, start, end ] = [ <Function> start ,              0, undefined ]; break;
      case 2: [ func, start, end ] = [ <Function>   end , <number> start, undefined ]; break;
      case 3:           /* works as specified */                                       break;

      default:
	throw TypeError("ImpositionBooklet.mapImposed() expects 1 to 3 arguments, got " + arguments.length);
    }

    return this.imposedSliceSpreads(<number> start, <number> end).map(<any> func);
  }

  createElement (tag : string, classes="", id="") : HTMLElement {
    const element     = document.createElement(tag);
    element.className = classes;
    element.id        = id;
    return element;
  }

  createSheetElement (id="") : HTMLElement {
    return this.createElement("div", "sheet", id);
  }

  createSpreadElement (id="") : HTMLElement {
    return this.createElement("div", "spread", id);
  }

  createPageElement (side : boolean, id="") : HTMLElement {
    const classes = `spread-page spread-${this.pageSideName(side)}`;
    return this.createElement("div", classes, id);
  }

  pageSideName (side: boolean) : string {
    return (<any>side ^ <any>this.right_to_left) ? "right" : "left";
  }
}


const book = new ImpositionBook();


function processZip (zipfile : File) {
  /*
    Read a zip file's contents, converting the files into image data URLS, and
    putting them into ImpositionImage objects. Return a promise that runs once
    all images are loaded.
  */

  return JSZip.loadAsync(zipfile).then( (zip) => {

    const images   : Array<ImpositionImage> = book.images = [];
    const promises : Array<Promise<void>>   = [];

    // Go through each file in the zip archive. For each, create a promise, and
    // return a promise which finishes once each file-read-promise is finished

    zip.forEach( (path, file) => {
      const img = new ImpositionImage();
      images.push(img);
      
      const promise : Promise<void> = file.async("blob").then( (blob) => {

	// Create a base64 image URI from the file contents, then use that to
	// create an image element.

	const content = URL.createObjectURL(blob);

	return new Promise( (resolve: Function, reject: Function) => {
	  img.element = document.createElement("img");

	  // Once the image is loaded, fire the ImpositionImage class' onload
	  // event

	  img.element.addEventListener('load', (e:Event) => {
	    img.onload(e);
	    return resolve()
	  });

	  img.element.addEventListener('error', (error) => reject(error));
	  img.src = img.element.src = content;
	});
      });

      promises.push(promise);
    });
    
    return Promise.all(promises);

  }, function zipReadError(err) {
      // TODO
  });
  
}

function processImage (file : File, refresh=true) : Promise<void> {
  return new Promise<void>( (resolve, reject) => {
    const img     = new ImpositionImage();
    const content = URL.createObjectURL(file);
    img.src = content;
    img.element   = document.createElement("img");
    img.element.src = content;

    book.images.push(img);

    img.element.addEventListener('load', (e) => {
      img.onload(e);
      return resolve();
    });

    img.element.addEventListener('error', (error) => reject(error));
  });
}


function processUpload (file: File) {
  if (file.type == "application/zip") {
    return processZip(file);
  }
  else if (file.type.startsWith("image/")) {
    return processImage(file);
  }

  const wrong_MIME_promise = new Promise( (resolve, reject) => {
    return reject(`Expected MIME type of application/zip or image/*, got ${file.type}`);
  });
}


function uploadFiles (files: any) : Promise<void> {
  return Promise.all(
    Array.from(files).map(processUpload)
  ).then( ()=> {
    book.refresh();
    
    // Enable page view buttons and select one

    const select_real_view    = document.getElementById("select-real-view");
    const select_imposed_view = document.getElementById("select-imposed-view");

    select_real_view.removeAttribute("disabled");
    select_imposed_view.removeAttribute("disabled");
    select_real_view.click();
  });
}


declare global {
  interface Window {
    uploaderHook: Function,
  }
};


function uploaderHook (uploader: HTMLInputElement) : Promise<void> {
  return uploadFiles(uploader.files);
}


window.uploaderHook = uploaderHook;

// Dragging and dropping files into the window


window.ondragover = function (event) {
  event.preventDefault();
}


window.ondrop = function (event) {
  event.preventDefault();
  uploadFiles(event.dataTransfer.files);
}


window.addEventListener("load", () => {
  book.real_pages = document.getElementById("real-pages");
  book.imposed_pages = document.getElementById("imposed-pages");

  document.getElementById("right-to-left").onchange = function(e) {
    book.right_to_left = (<HTMLInputElement> e.target).checked;
    book.refresh();
  };

  document.getElementById("back-cover-toggle").onchange = function(e) {
    book.has_back_cover = (<HTMLInputElement> e.target).checked;
    book.refresh();
  };

  document.getElementById("crease-margin").onchange = function(e: Event) {
    (<HTMLInputElement> this).value = parseFloat((<HTMLInputElement> this).value).toFixed(1);
    setMargin((<HTMLInputElement> e.target).value);
  };

  function handleViewChange (e: any) {
    document.getElementById("pages-welcome").classList.add("hidden");

    if (e.target.id == "select-real-view") {
      book.real_pages.classList.remove('hidden');
      book.imposed_pages.classList.add('hidden');
    }
    else {
      book.real_pages.classList.add('hidden');
      book.imposed_pages.classList.remove('hidden');
    }
  }

  document.getElementById("select-real-view").onchange    = handleViewChange;
  document.getElementById("select-imposed-view").onchange = handleViewChange;

});
