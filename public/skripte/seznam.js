// Globalne spremenljivke
let sifranti = {
  leto: [],
  zanr: [],
};
let filmi = [];

// Premakni film iz seznama (desni del) v košarico (levi del)
const premakniFilmIzSeznamaVKosarico = (
  id,
  naslov,
  datum,
  ocena,
  trajanje,
  azuriraj
) => {
  if (azuriraj)
    $.get("/kosarica/" + id, (podatki) => {
      /* Dodaj izbran film v sejo */
    });

  // Dodaj film v desni seznam
  $("#kosarica").append(
    "<div id='" +
      id +
      "' class='film'> \
           <button type='button' class='btn btn-light btn-sm'> \
             <i class='fas fa-minus'></i> \
               <strong><span class='naslov' dir='ltr'>" +
      naslov +
      "</span></strong> \
           <i class='fas fa-calendar-days'></i><span class='datum-izdaje'>" +
      datum +
      "</span> \
          <i class='fas fa-signal'></i><span class='ocena'>" +
      ocena +
      "</ocena>\
          <i class='far fa-clock'></i><span class='trajanje'>" +
      trajanje +
      "</span> min \
            </button> \
          </div>"
  );

  // Dogodek ob kliku na film v košarici (na desnem seznamu)
  $("#kosarica #" + id + " button").click(function () {
    let film_kosarica = $(this);
    $.get("/kosarica/" + id, (podatki) => {
      /* Odstrani izbrano film iz seje */
      // Če je košarica prazna, onemogoči gumbe za pripravo računa
      if (!podatki || podatki.length == 0) {
        $("#racun_html").prop("disabled", true);
        $("#racun_xml").prop("disabled", true);
      }
    });
    // Izbriši film iz desnega seznama
    film_kosarica.parent().remove();
    // Pokaži film v levem seznamu
    $("#filmi #" + id).show();
  });

  // Skrij film v levem seznamu
  $("#filmi #" + id).hide();
  // Ker košarica ni prazna, omogoči gumbe za pripravo računa
  $("#racun_html").prop("disabled", false);
  $("#racun_xml").prop("disabled", false);
};

$(document).ready(() => {
  // Posodobi izbirne gumbe filtrov
  $.get("/filtri", (podatki) => {
    sifranti = podatki.sifranti;
    filmi = podatki.filmi;
    let parametri = ["leto", "zanr"];

    parametri.forEach((parameter) => {
      $("#" + parameter + "-stevilo").html(sifranti[parameter].length);
      $("#" + parameter + "-izbira").append("<option val=''>...</option>");
      sifranti[parameter].forEach((vrednost) => {
        $("#" + parameter + "-izbira").append(
          "<option value='" + vrednost + "'>" + vrednost + "</option>"
        );
      });
    });
  });

  // Posodobi podatke iz košarice na spletni strani
  $.get("/kosarica", (kosarica) => {
    kosarica.forEach((film) => {
      premakniFilmIzSeznamaVKosarico(
        film.stevilkaArtikla,
        film.opisArtikla.split(" (")[0],
        film.datumIzdaje,
        film.ocena,
        film.trajanje,
        false
      );
    });
  });

  $("#leto-izbira").change(() => {
    letoZanrChange();
  });

  $("#zanr-izbira").change(() => {
    letoZanrChange();
  });

  // Klik na film v levem seznamu sproži
  // dodajanje filma v desni seznam (košarica)
  $("#filmi .film button").click(function () {
    let film = $(this);
    premakniFilmIzSeznamaVKosarico(
      film.parent().attr("id"),
      film.find(".naslov").text(),
      film.find(".datum-izdaje").text(),
      film.find(".ocena").text(),
      film.find(".trajanje").text(),
      true
    );
  });

  // Klik na gumba za pripravo računov
  $("#racun_html").click(() => (window.location = "/izpisiRacun/html"));
  $("#racun_xml").click(() => (window.location = "/izpisiRacun/xml"));

  $.get("/podroben-seznam-filmov", (data) => {
    let oldestDateFormat = findTheOldestYear(data);
    let newestDateFormat = findTheNewestYear(data);
    let oldest = oldestDateFormat.getFullYear();
    let newest = newestDateFormat.getFullYear();

    //console.log(oldestDateFormat);
    //console.log(new Date(oldest, 0));
    //console.log(data);

    let graphInfo1 = [];
    let graphInfo2 = [];

    let k = 0;
    for (let i = oldest - 1; i < newest; i = i + 5) {
      graphInfo1[k] = {
        x: new Date(i, 0),
        y: calculateForY(i, i + 4, data, "Comedy", "Family", "Romance"),
      };
      ++k;
    }

    let q = 0;
    for (let i = oldest - 1; i < newest; i = i + 5) {
      graphInfo2[q] = {
        x: new Date(i, 0),
        y: calculateForY(i, i + 4, data, "Drama", "Thriller", "Action"),
      };
      ++q;
    }

    let graph = new CanvasJS.Chart("chartContainer", {
      title: {
        text: "Najboljši filmi čez čas",
        fontColor: "#580000",
      },
      toolTip: {
        enabled: true,
        contentFormatter: function (e) {
          let rez = "<span style='color:00468b'>";
          rez +=
            e.entries[0].dataPoint.x.getFullYear() +
            ":</span> " +
            e.entries[0].dataPoint.y;
          return rez;
        },
      },
      axisX: {
        valueFormatString: "YYYY",
        crosshair: {
          enabled: true,
          //snapToDataPoint: true,
        },
      },
      axisY: {
        title: "Število filmov",
        includeZero: true,

        crosshair: {
          enabled: true,
        },
      },
      data: [
        {
          type: "line",
          lineColor: "#FFA500",
          lineDashType: "dash",
          color: "#FFA500",
          name:
            "Komedije, družinski in romance (" + calculateSum(graphInfo1) + ")",
          showInLegend: true,
          dataPoints: graphInfo1.filter((graph) => graph.y > 0),
        },
        {
          type: "line",
          lineColor: "#00468b",
          markerType: "square",
          color: "#00468b",
          name: "Drame, akcije in trilerji (" + calculateSum(graphInfo2) + ")",
          showInLegend: true,
          dataPoints: graphInfo2.filter((graph) => graph.y > 0),
        },
      ],
      subtitles: [
        {
          text: "grupirani žanri",
          fontColor: "#009900",
        },
      ],
    });
    //console.log(graphInfo2);

    graph.render();
  });
});

let calculateSum = (data) => {
  let cnt = 0;
  //console.log(data);
  for (let i = 0; i < data.length; ++i) {
    if (data[i].y != null) {
      cnt += data[i].y;
    }
  }
  return cnt;
};

let calculateForY = (a, b, data, zanr1, zanr2, zanr3) => {
  let cnt = 0;
  for (let i = 0; i < data.length; ++i) {
    let dateOfI = new Date(data[i].datumIzdaje);

    if (
      dateOfI.getFullYear() >= a &&
      dateOfI.getFullYear() <= b &&
      (data[i].zanri.includes(zanr1) ||
        data[i].zanri.includes(zanr2) ||
        data[i].zanri.includes(zanr3))
    ) {
      ++cnt;
    }
  }
  if (cnt == 0) return null;
  return cnt;
};

let findTheOldestYear = (data) => {
  let start = new Date(data[0].datumIzdaje);
  let temp = start.getFullYear();
  for (let i = 1; i < data.length; ++i) {
    let loopTemp = new Date(data[i].datumIzdaje);
    if (loopTemp.getFullYear() < temp) {
      start = loopTemp;
      temp = loopTemp.getFullYear();
    }
  }
  return start;
};

let findTheNewestYear = (data) => {
  let start = new Date(data[0].datumIzdaje);
  let temp = start.getFullYear();
  for (let i = 1; i < data.length; ++i) {
    let loopTemp = new Date(data[i].datumIzdaje);
    if (loopTemp.getFullYear() > temp) {
      start = loopTemp;
      temp = loopTemp.getFullYear();
    }
  }
  return start;
};

let letoZanrChange = () => {
  let letoVrednost = $("#leto-izbira").val();
  let zanrVrednost = $("#zanr-izbira").val();
  if (zanrVrednost === "...") zanrVrednost = "";
  //console.log(letoVrednost);
  //console.log(zanrVrednost);

  let filmi = $("#Filmi");
  let cnt =0;
  let niz=[];
  let godini = new Set();

  $.get("/podroben-seznam-filmov", (data) => {
    //console.log(data);
    for (let i = 0; i < data.length; ++i) {
      let id = data[i].id;
      if (letoVrednost === "...") {
        if (data[i].zanri.includes(zanrVrednost)) {
          document.getElementById(id).style.opacity = "1";
          niz.push(i);

        } else {
          document.getElementById(id).style.opacity = "0.3";
        }
      } else {
        let datum = new Date(data[i].datumIzdaje);
       // console.log(letoVrednost == datum.getFullYear());
        if (
          data[i].zanri.includes(zanrVrednost) &&
          (datum.getFullYear() == letoVrednost)
        ) {
          document.getElementById(id).style.opacity = "1";
          niz.push(i);

        } else {
          document.getElementById(id).style.opacity = "0.3";
        }
      }
    }

    Array.from(document.getElementById("zanr-izbira").options).forEach(function (e) {
      let optionText = e.text;
      let contains = false;
      for(let i=0; i<niz.length; ++i){
        if(data[niz[i]].zanri.includes(optionText)) contains=true;
        let tempDate = new Date(data[niz[i]].datumIzdaje)
        godini.add(tempDate.getFullYear());
  
      }

      if(contains || (optionText=="...")){
        e.disabled = false;
        ++cnt;
      }
      else{
        e.disabled = true;

      }

     
    });


  
    $("#zanr-stevilo").text(cnt-1);
    $("#leto-stevilo").text(godini.size);
  
  
  });



};
