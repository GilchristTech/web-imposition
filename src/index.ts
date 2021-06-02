import * as      JSZip from        'jszip';
import * as Imposition from './imposition';

import { ImpositionImage } from './imposition';


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
    promises.push( file.async("blob").then(
	(blob) => ImpositionImage.fromBlob(blob)
    ));
  });
  
  return Promise.all( promises ).then( (images: any) => {
      book.images = <ImpositionImage[]> images;
      return images;
  });
}


function processImage (file : File, refresh=true) : Promise<ImpositionImage> {
  const book_image_index = book.images.length;

  return ImpositionImage.fromURL(
    URL.createObjectURL(file)
  ).then( (image: ImpositionImage) => {
    book.images[book_image_index] = image;
    return image;
  });
}


function processFile (file: File) : Promise<ImpositionImage|ImpositionImage[]> {
  /*
     Given a file, read it's MIME type, and process it as either a zip or image.
  */

  if (file.type == "application/zip") {
    return processZip(file);
  }
  else if (file.type.startsWith("image/")) {
    return processImage(file);
  }

  return new Promise<ImpositionImage>( (resolve, reject) => {
    reject(`Expected MIME type of application/zip or image/*, got ${file.type}`);
  });
}


function uploadFiles (files: any) : Promise<void> {
  return Promise.all(
    Array.from(files).map(processFile)
  ).then( (result_sets: Array<ImpositionImage[]>)=> {
    book.refresh();
    
    // Enter real view
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
    uploaderHook: Function,
    book: Imposition.ImpositionBook
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
  return uploadFiles(uploader.files);
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


/*
  Page load
*/

window.addEventListener("load", () => {
  book.real_pages    = document.getElementById("real-pages");
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

  document.getElementById("load-sample-doc").onclick = function () {
    /*
       Download a sample file, a zip of images, load it, and display the
       contents.
    */

    fetch("static/sample.zip")
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
	  book.refresh();
	  enableViews();
	  document.getElementById("select-real-view").click();
	},

	function handleError (err) {
	  alert(`An error occured in loading the sample document: ${err}`);
	}
      );
  };

});
