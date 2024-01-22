import * as Imposition from       './imposition';
import * as      JSZip from              'jszip';
import * as      PDFJS from         'pdfjs-dist';
import  { Spinner }    from  './loading-spinner';

import './interface.css';

import { ImpositionImage } from './imposition';

import { ImagePropertiesContext } from  './image_edit_modal';

import {
  PDFPageProxy, PDFDocumentProxy
} from 'pdfjs-dist';

// Shorten the names of PDF proxy objects for the sake of brevity in other
// declarations.

type PDFPage     = PDFPageProxy;
type PDFDocument = PDFDocumentProxy;


function processZip (zip : (File|JSZip)) : Promise<ImpositionImage[]> {
  /*
    Read a zip file's contents, converting the files into image data URLS, and
    putting them into ImpositionImage objects. Return a promise that runs once
    all images are loaded.
  */

  if (zip instanceof JSZip) {
    return processZipContents(<JSZip> zip);
  }

  // zip is File
  return processZipFile(<File> zip);
}


function processZipFile (zipfile: File) : Promise<ImpositionImage[]> {
  /*
    Given a file object, open it as a JSZip and read its contents, converting
    the files into image data URLS, and putting them into
    ImpositionImage objects. Return a promise that runs once all
    images are loaded.
  */

  return JSZip.loadAsync( zipfile ).then(
    processZipContents,
  );
}


function processZipContents (zip: JSZip) : Promise<ImpositionImage[]> {
  /*
    Given a JSZip, read each of its files.
  */

  const promises : Promise<ImpositionImage>[] = [];

  // Go through each file in the zip archive. For each, create a promise, and
  // return a promise which finishes once each file-read-promise is finished

  zip.forEach( (path, file) => {
    promises.push(
      file.async("blob").then(
	(blob) => ImpositionImage.fromBlob(blob)
      ).then(
	img => {
	  img.name = file.name; return img
	}
      )
    )
  });
  
  return <Promise<ImpositionImage[]>> Promise.all( promises );
}


function processPDFContents (pdf: PDFDocument) : Promise<ImpositionImage[]> {
  /*
    Given a PDF document, promise to convert each page into an ImpositionImage
  */
  
  const promises : Promise<ImpositionImage>[]  = [];

  for (let page_num = 0; page_num < pdf.numPages; page_num++) {
    promises[page_num] = pdf.getPage( page_num + 1 ).then( ImpositionImage.fromPDFPage );
  }

  return <Promise<ImpositionImage[]>> Promise.all(promises);
}


function processPDFFile (file: File) : Promise<ImpositionImage[]> {
  return new Promise<ImpositionImage[]>( (resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (event) {
      const target = <FileReader> event.target;

      PDFJS.getDocument( new Uint8Array(<ArrayBuffer> target.result))
      .promise
      .then( processPDFContents )
      .then( (pages: Array<ImpositionImage>) => {
	resolve(pages);
      })
      
    }

    reader.readAsArrayBuffer(file)
  });
}


function processImage (file : File, refresh=true) : Promise<ImpositionImage> {
  return ImpositionImage.fromURL(
    URL.createObjectURL(file)
  );
}


function processFile (file: File) : Promise<ImpositionImage|ImpositionImage[]> {
  /*
     Given a file, read it's MIME type, and process it as either a zip or image.
  */
  
  switch(file.type) {
    case "application/zip":
      return processZip(file);

    case "application/pdf":
      return processPDFFile(file);

    default:
      if (file.type.startsWith("image/")) {
	return processImage(file);
      }
      break;
  };

  return new Promise<ImpositionImage>( (resolve, reject) => {
    reject(`Expected MIME type for a PDF, ZIP, or image, got ${file.type}`);
  });
}


function uploadFiles (files: any) : Promise<void> {
  return Promise.all(
    Array.from(files).map(processFile)
  ).then(
    (result_sets) => {

    // Flatten results

    let pages : Array<ImpositionImage> = [];

    for (let results of result_sets) {
      if (results instanceof ImpositionImage) {
	pages.push(<ImpositionImage> results);
      }
      else {
	pages = pages.concat(<ImpositionImage[]> results);
      }
    }


    return pages;
  })
  .then( (pages: Array<ImpositionImage>) => {
    book.images = book.images.concat(pages);
    refresh();
    
    // Enter real view
    enableViews();
    document.getElementById("select-real-view").click();
  });
}


function enableViews () : void {
  const select_real_view    = document.getElementById("select-real-view");
  const select_imposed_view = document.getElementById("select-imposed-view");

  select_real_view.removeAttribute("disabled");
  select_imposed_view.removeAttribute("disabled");
}


function disableViews () : void {
  const select_real_view    = document.getElementById("select-real-view");
  const select_imposed_view = document.getElementById("select-imposed-view");

  select_real_view.setAttribute("disabled", null);
  select_imposed_view.setAttribute("disabled", null);
}


declare global {
  interface Window {
    uploaderHook    : Function,
    book            : Imposition.ImpositionBook,
    content_spinner : Spinner,
    contentTask     : Function
  }
};


const book = window.book = new Imposition.ImpositionBook();


type EventHandler = (event: Event) => void;


function addEvent (listener : EventTarget, eventName: string) : (h:EventHandler) => void {
  /*
    Decorator function for adding events to EventTarget objects such as an Element, Window, or Document.

    Example usage:
      @addEvent(window, "load")
      function onWindowLoad (event) {
	...
      }
  */

  return function (eventHook: EventHandler ) : void {
    listener.addEventListener(eventName, eventHook);
  }
}


function uploaderHook (uploader: HTMLInputElement) : Promise<void> {
  return window.contentTask( uploadFiles(uploader.files) );
}


window.uploaderHook = uploaderHook;

/*
  Dragging and dropping files into the window
*/

window.ondragover = function (event) {
  event.preventDefault();
}


window.ondrop = function (event) {
  event.preventDefault();
  uploadFiles(event.dataTransfer.files);
}


function refresh() : void {
  book.refresh();

  const pages_list = document.getElementById("pages-list");
  const list_item_template = (<any> document.getElementById("page-list-item-template")).content;

  pages_list.innerHTML = "";

  /*
    For each source image, add a page to the pages list.
  */

  for (let i in book.images) {
    const page = book.images[i];
    const page_list_element : HTMLElement = list_item_template.cloneNode(true).childNodes[1];

    page_list_element.setAttribute("data-key", i);
    page_list_element.setAttribute("data-name", page.name ?? "");

    const page_name_element : HTMLAnchorElement = page_list_element.querySelector(".page-name");
    page_name_element.textContent = `${page.name ?? "(untitled page)"}`;

    page_name_element.addEventListener("click", async (e) => {
      let new_image;

      try {
	new_image = await ImagePropertiesContext.editorForm( page );
      }
      catch (err) {
	// If the form was cancelled, let the error slide, otherwise, re-throw
	// it

	if (err === "FORM_CANCELLED") {
	  return;
	}
	
	throw err;
      }

      // If the editor form promise returned null, delete the image
      if (new_image === null) {
	book.images.splice(parseInt(i), 1);
	refresh();
	return;
      }

      book.images[i] = new_image;
      refresh();
    });

    pages_list.appendChild(page_list_element);
  }
}


/*
  Page load
*/

window.addEventListener("load", () => {
  book.real_pages    = document.getElementById("real-pages");
  book.imposed_pages = document.getElementById("imposed-pages");

  window.content_spinner = new Spinner(<HTMLElement> document.querySelector("#content-modal .spinner-ring"));
  window.contentTask = function( task : Promise<any> ) : Promise<any> {
    const modal = document.querySelector("#content-modal");

    modal.classList.remove("hidden");

    return window.content_spinner.task(task).then( (value) => {
      if (window.content_spinner.num_tasks == 0) {
	modal.classList.add("hidden");
      }

      return value;
    });
  };

  document.getElementById("right-to-left").onchange = function(e) {
    book.right_to_left = (<HTMLInputElement> e.target).checked;
    refresh();
  };

  document.getElementById("back-cover-toggle").onchange = function(e) {
    book.has_back_cover = (<HTMLInputElement> e.target).checked;
    refresh();
  };

  document.getElementById("crease-margin").onchange = function(e: Event) {
    (<HTMLInputElement> this).value = parseFloat((<HTMLInputElement> this).value).toFixed(1);
    Imposition.setMargin((<HTMLInputElement> e.target).value);
  };

  function handleViewChange (e: any) {
    enableViews();
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

  /*
  document.getElementById("load-sample-doc").onclick = function () {
     // Download a sample file, a zip of images, load it, and display the
     // contents.

    document.querySelector("#content-modal").classList.remove("hidden");

    fetch("./static/sample.zip")
      .then( response => {
	switch (response.status) {
	  case 200:
	  case   0:
	    return Promise.resolve(response.blob());

	  default:
	    return Promise.reject(`Could not fetch sample document, HTTP status code: ${response.status}`);
	}
      })
      .then( JSZip.loadAsync    )
      .then( processZipContents )
      .then(
	(pages) => {
	  refresh();
	  enableViews();
	  document.getElementById("select-real-view").click();
	},

	function handleError (err) {
	  alert(`An error occured in loading the sample document: ${err}`);
	}
      )
      .finally( () => {
	document.querySelector("#content-modal").classList.add("hidden");
      });
  };
  */


  document.getElementById("load-sample-pdf").onclick = function () {
    /*
       Download a sample file, a PDF, and impose its contents
    */
   
    window.contentTask(
      PDFJS.getDocument( "./static/sample.pdf" ).promise
      .then( (v: any) => {
	document.querySelector("#content-modal").classList.remove("hidden");
	return v;
      })
      .then( processPDFContents )
      .then(
	(pages: Array<ImpositionImage>) => {
	  // Assign names to each image
	  
	  for (let i = 0; i < pages.length; i++) {
	    const page = pages[i];
	    page.name = "Sample PDF pg. " + (i+1);
	  }

	  // Move pages into ImpositionBook and refresh view
	  
	  book.images = pages;
	  refresh();
	  enableViews();
	  document.getElementById("select-real-view").click();
	},

	(error: any) => alert(`An error occured in loading the sample document: ${error}`)
      )
      .finally( () => {
	document.querySelector("#content-modal").classList.add("hidden");
      })
    );

  };
  
});
