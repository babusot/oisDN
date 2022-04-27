if (!process.env.PORT) process.env.PORT = 8080;

// Priprava povezave na podatkovno bazo
const sqlite3 = require("sqlite3").verbose();
const pb = new sqlite3.Database("MovieInvoice.sl3");

// Priprava dodatnih knjižnic
const formidable = require("formidable");

// Priprava strežnika
const express = require("express");
const streznik = express();
streznik.set("view engine", "hbs");
streznik.use(express.static("public"));

// Podpora sejam na strežniku
const expressSession = require("express-session");
const res = require("express/lib/response");
streznik.use(
  expressSession({
    secret: "123456789QWERTY", // Skrivni ključ za podpisovanje piškotov
    saveUninitialized: true, // Novo sejo shranimo
    resave: false, // Ne zahtevamo ponovnega shranjevanja
    cookie: {
      maxAge: 3600000, // Seja poteče po 1 h neaktivnosti
    },
  })
);

var tipiPodjetij = [
  { tip: "ni podjetja", vrednost: "" },
  { tip: "zadruga", vrednost: " zadruga" },
  { tip: "so.p.", vrednost: " so.p." },
  { tip: "s.p.", vrednost: " s.p." },
  { tip: "d.o.o.", vrednost: " d.o.o." },
  { tip: "d.n.o.", vrednost: " d.n.o." },
  { tip: "d.d.", vrednost: " d.d." },
  { tip: "k.d.", vrednost: " k.d." },
];

// Vrne naziv stranke (ime in priimek) glede na ID stranke
const vrniNazivStranke = (strankaId, povratniKlic) => {
  pb.all(
    "SELECT Customer.FirstName || ' ' || Customer.LastName AS naziv \
     FROM   Customer \
     WHERE  Customer.CustomerId = $id",
    { $id: strankaId },
    (napaka, vrstica) => {
      if (napaka) povratniKlic("");
      else povratniKlic(vrstica.length > 0 ? vrstica[0].naziv : "");
    }
  );
};

// Vrni seznam filmov
const vrniSeznamFilmov = (povratniKlic) => {
  pb.all(
    "SELECT   Movie.MovieId AS id, \
              Movie.OriginalTitle AS naslov, \
              Movie.VoteAverage AS ocena, \
              COUNT(InvoiceLine.InvoiceId) AS steviloProdaj, \
              GROUP_CONCAT(DISTINCT Language.NameShort) AS jeziki, \
              Movie.ReleaseDate AS datumIzdaje, \
              Movie.Runtime AS trajanje, \
              Movie.Revenue AS dobicek, \
              Movie.Budget AS stroski, \
              GROUP_CONCAT(DISTINCT Genre.Name) AS zanri \
     FROM     Movie, Language, MovieSpokenLanguages, Genre, \
              MovieGenres, InvoiceLine \
     WHERE    Language.LanguageId = MovieSpokenLanguages.LanguageId AND \
              Movie.MovieId = MovieSpokenLanguages.MovieId AND \
              Genre.GenreId = MovieGenres.GenreId AND \
              Movie.MovieId = MovieGenres.MovieId AND \
              Movie.MovieId = InvoiceLine.MovieId \
     GROUP BY Movie.MovieId \
     ORDER BY ocena DESC, steviloProdaj DESC, naslov ASC \
     LIMIT    100",
    (napaka, vrstice) => {
      for (let i = 0; i < vrstice.length; i++)
        vrstice[i].marketing = "obicajno";
      povratniKlic(napaka, vrstice);
    }
  );
};

// Vrni podrobnosti filma v košarici iz podatkovne baze
const filmiIzKosarice = (zahteva, povratniKlic) => {
  // Če je košarica prazna
  if (!zahteva.session.kosarica || zahteva.session.kosarica.length == 0) {
    povratniKlic([]);
  } else {
    pb.all(
      "SELECT   DISTINCT Movie.MovieId AS stevilkaArtikla, \
                1 AS kolicina, \
                Movie.OriginalTitle || ' (' || \
                  STRFTIME('%Y',Movie.ReleaseDate) || ')' AS opisArtikla, \
                Movie.OriginalTitle AS naslov, \
                Language.NameShort AS jezik, \
                Movie.Runtime AS trajanje, \
                Movie.VoteAverage AS ocena, \
                Movie.ReleaseDate AS datumIzdaje, \
                GROUP_CONCAT(DISTINCT Genre.Name) AS zanri \
       FROM     Movie, Genre, MovieGenres, Language \
       WHERE    Genre.GenreId = MovieGenres.GenreId AND \
                Movie.LanguageId = Language.LanguageId AND \
                Movie.MovieId = MovieGenres.MovieId AND \
                Movie.MovieId IN (" +
        zahteva.session.kosarica.join(",") +
        ") \
       GROUP BY Movie.MovieId",
      (napaka, vrstice) => {
        if (napaka) povratniKlic(false);
        else povratniKlic(vrstice);
      }
    );
  }
};

// Vrni podrobnosti filmov na računu
const filmiIzRacuna = function (racunId, povratniKlic) {
  pb.all(
    "SELECT DISTINCT Movie.MovieId AS stevilkaArtikla, \
            Movie.OriginalTitle || ' (' || \
              STRFTIME('%Y',Movie.ReleaseDate) || ')' AS opisArtikla, \
            Movie.Runtime AS trajanje, \
            Movie.VoteAverage AS ocena, \
            Movie.ImdbId AS imdb, \
            1 AS kolicina, \
            0 AS popust, \
            Language.NameShort AS jezik \
     FROM   Movie, Language, Invoice \
     WHERE  Movie.LanguageId = Language.LanguageId AND \
            Movie.MovieId IN ( \
              SELECT InvoiceLine.MovieId \
              FROM   InvoiceLine, Invoice \
              WHERE  InvoiceLine.InvoiceId = Invoice.InvoiceId AND \
                     Invoice.InvoiceId = $id \
            )",
    { $id: racunId },
    (napaka, vrstice) => {
      if (napaka) povratniKlic(false);
      else povratniKlic(napaka, vrstice);
    }
  );
};

// Vrni podrobnosti o stranki iz računa
const strankaIzRacuna = (racunId, povratniKlic) => {
  pb.all(
    "SELECT Customer.* \
     FROM   Customer, Invoice \
     WHERE  Customer.CustomerId = Invoice.CustomerId AND \
            Invoice.InvoiceId = $id",
    { $id: racunId },
    function (napaka, vrstice) {
      if (napaka) povratniKlic(false);
      else povratniKlic(vrstice[0]);
    }
  );
};

// Vrni podrobnosti o stranki iz seje
const strankaIzSeje = (zahteva, povratniKlic) => {
    //console.log(zahteva.session.trenutnaStranka);

  pb.all(
    "SELECT * \
    FROM Customer \
    Where Customer.CustomerId = $customerID",
    {$customerID: zahteva.session.trenutnaStranka},
    (err, data) => {
      if(err) povratniKlic(false);
      else {
          //console.log(data[0]);
        povratniKlic(data[0]);}
    }
  );
};

// Vrni stranke iz podatkovne baze
const vrniStranke = (povratniKlic) => {
  pb.all("SELECT * FROM Customer", (napaka, stranke) => {
    povratniKlic(napaka, stranke);
  });
};

// Vrni račune iz podatkovne baze
const vrniRacune = (povratniKlic) => {
  pb.all(
    "SELECT Customer.FirstName || ' ' || Customer.LastName || \
              ' (' || Invoice.InvoiceId || ') - ' || \
              DATE(Invoice.InvoiceDate) AS Naziv, \
            Customer.CustomerId AS IdStranke, \
            Invoice.InvoiceId \
     FROM   Customer, Invoice \
     WHERE  Customer.CustomerId = Invoice.CustomerId",
    (napaka, vrstice) => povratniKlic(napaka, vrstice)
  );
};

// Vrni stranko glede na priimek podan z velikimi tiskanimi črkami
const najdiStrankoPoPriimku = (priimek, povratniKlic) => {
  pb.get(
    "SELECT * \
     FROM   Customer \
     WHERE  Customer.LastName IS NOT NULL AND \
            UPPER(Customer.LastName) == $priimek \
     LIMIT  1",
    { $priimek: priimek },
    (napaka, stranka) => povratniKlic(napaka, stranka)
  );
};

const najdiPodobnoStranko = (prenos, povratniKlic) => {
  pb.get(
    "SELECT * \
     FROM CUSTOMER \
     WHERE Customer.Lastname IS NOT NULL AND \
           UPPER(Customer.LastName) == $priimek AND \
           Customer.FirstName IS NOT NULL AND \
           UPPER(Customer.FirstName) == $ime \
    LIMIT 1",
    {
      $ime: prenos.ime,
      $priimek: prenos.priimek,
    },
    (napaka, stranka) => povratniKlic(napaka, stranka)
  );
};

// Prikaz začetne strani
streznik.get("/", (zahteva, odgovor) => {
  vrniSeznamFilmov((napaka, vrstice) => {
    if (napaka) {
      odgovor.sendStatus(500);
    } else {
      let zanri = new Set();
      for (let i = 0; i < vrstice.length; i++) {
        vrstice[i].cena = (
          vrstice[i].cena *
          (1 + vrstice[i].stopnja / 100)
        ).toFixed(2);
        zanri.add(vrstice[i].zanr);
      }
    }
    vrniNazivStranke(zahteva.session.trenutnaStranka, (nazivOdgovor) => {
      //console.log(vrstice[0].jeziki[0]);

      odgovor.render("seznam", {
        podnaslov: "Nakupovalni seznam",
        prijavniGumb: "Odjava",
        seznamFilmov: changeStringToAnArray(vrstice),
        nazivStranke: zahteva.session.trenutnaStranka ? nazivOdgovor : "gosta",
      });
    });
  });
});

let changeStringToAnArray = (niz) => {
  for(let i=0; i<niz.length; ++i){
    let temp = niz[i].jeziki.split(',');
   // console.log(temp);
    for(let k=0; k<temp.length; ++k){
      if(temp[k]=="en") temp[k]="gb";
      if(temp[k]=="zh") temp[k]="cn";
      if(temp[k]=="eo" || temp[k]=="xx") temp[k]="mk";
      if(temp[k]=="fa") temp[k]="ir";
      if(temp[k]=="ia") temp[k]="eu";
      if(temp[k]=="ja") temp[k]="jp";

    }

    niz[i].jeziki=temp;
  } 
  //console.log(niz[3].jeziki[0]);
  return niz;
}

// Dodajanje oz. brisanje filmov iz košarice
streznik.get("/kosarica/:idFilma", (zahteva, odgovor) => {
  let idFilma = parseInt(zahteva.params.idFilma, 10);

  if (!zahteva.session.kosarica) zahteva.session.kosarica = [];

  if (zahteva.session.kosarica.indexOf(idFilma) > -1) {
    // Če je pesem v košarici, jo izbrišemo
    zahteva.session.kosarica.splice(
      zahteva.session.kosarica.indexOf(idFilma),
      1
    );
  } else {
    // Če filma ni v košarici, jo dodamo
    zahteva.session.kosarica.push(idFilma);
  }
  // V odgovoru vrnemo vsebino celotne košarice
  odgovor.send(zahteva.session.kosarica);
});

// Vrni podrobnosti košarice
streznik.get("/kosarica", (zahteva, odgovor) => {
  filmiIzKosarice(zahteva, (filmi) => {
    if (!filmi) odgovor.sendStatus(500);
    else odgovor.send(filmi);
  });
});

// Izpis račun v HTML predstavitvi na podlagi podatkov iz baze
streznik.post("/izpisiRacunBaza", (zahteva, odgovor) => {
  const form = formidable({ multiples: true });
  form.parse(zahteva, (err, fields) => {
    if (err) {
      next(err);
      return;
    }

    let fieldsData = fields;
    let id = fieldsData.seznamRacunov;

    strankaIzRacuna(id, (stranka) => {
      filmiIzRacuna(id, (err, filmi) => {

        let povzetek = {
          vsotaSPopustiInDavki: 0,
          vsoteZneskovDdv: {
            9.5: 0,
            22: 0,
            0: 0,
          },
          vsoteOsnovZaDdv: {
            9.5: 0,
            22: 0,
            0: 0,
          },
          vsotaVrednosti: 0,
          vsotaPopustov: 0,
        };


        for (let i = 0; i < filmi.length; ++i) {
          filmi[i].zapSt = i + 1;
          filmi[i].cena = filmi[i].trajanje * 0.015;
          filmi[i].vrednost = filmi[i].kolicina * filmi[i].cena;
          filmi[i].osnovaZaDdvInDdv = filmi[i].cena;
          filmi[i].davcnaStopnja = 22;
          filmi[i].popustStopnja = 0;
          filmi[i].popust =
            filmi[i].kolicina * filmi[i].cena * (filmi[i].popustStopnja / 100);
          filmi[i].osnovaZaDdv = filmi[i].vrednost - filmi[i].popust;
          filmi[i].ddv = filmi[i].osnovaZaDdv * filmi[i].davcnaStopnja/100;
          filmi[i].osnovaZaDdvInDdv = filmi[i].ddv + filmi[i].osnovaZaDdv;
          povzetek.vsotaSPopustiInDavki += filmi[i].osnovaZaDdv + filmi[i].ddv;
          povzetek.vsoteZneskovDdv["" +filmi[i].davcnaStopnja] += filmi[i].ddv;
          povzetek.vsoteOsnovZaDdv[""+ filmi[i].davcnaStopnja] += filmi[i].osnovaZaDdv;
          povzetek.vsotaVrednosti += filmi[i].vrednost;
          povzetek.vsotaPopustov += filmi[i].popust;
        }

        odgovor.setHeader("Content-Type", "text/xml");
        odgovor.render("eslog", {
          vizualiziraj: true,
          stranka: stranka,
          povzetekRacuna: povzetek,
          postavkeRacuna: filmi,
          layout: null,
        });
      });
    });
  });
});

const todayDate = new Date(2022, 04, 16);

// Izpis računa v HTML predstavitvi ali izvorni XML obliki
streznik.get("/izpisiRacun/:oblika", (zahteva, odgovor) => {
  strankaIzSeje(zahteva, (stranka) => {
    //console.log(stranka);
    //console.log("GAS");
    filmiIzKosarice(zahteva, (filmi) => {
      if (!filmi) {
        odgovor.sendStatus(500);
      } else if (filmi.length == 0) {
        odgovor.send(
          "<p>V košarici nimate nobenega filma, " +
            "zato računa ni mogoče pripraviti!</p>"
        );
      } else {
        let povzetek = {
          vsotaSPopustiInDavki: 0,
          vsoteZneskovDdv: { 0: 0, 9.5: 0, 22: 0 },
          vsoteOsnovZaDdv: { 0: 0, 9.5: 0, 22: 0 },
          vsotaVrednosti: 0,
          vsotaPopustov: 0,
        };

        filmi.forEach((film, i) => {
          film.zapSt = i + 1;
          film.cena = film.trajanje / 100;
          film.vrednost = film.kolicina * film.cena;
          film.davcnaStopnja = 22;

          film.popustStopnja = 0;

          let tempDate = new Date(film.datumIzdaje);
          tempDate=tempDate.getTime();
          let tempTodayDate = todayDate.getTime();
          let razlika = Math.floor(((tempTodayDate-tempDate)/(1000*3600*24))/3650);
          //console.log(razlika);
          film.popustStopnja += 4*razlika;

          film.popust = film.kolicina * film.cena * (film.popustStopnja / 100);

          film.osnovaZaDdv = film.vrednost - film.popust;
          film.ddv = film.osnovaZaDdv * (film.davcnaStopnja / 100);
          film.osnovaZaDdvInDdv = film.osnovaZaDdv + film.ddv;

          povzetek.vsotaSPopustiInDavki += film.osnovaZaDdv + film.ddv;
          povzetek.vsoteZneskovDdv["" + film.davcnaStopnja] += film.ddv;
          povzetek.vsoteOsnovZaDdv["" + film.davcnaStopnja] += film.osnovaZaDdv;
          povzetek.vsotaVrednosti += film.vrednost;
          povzetek.vsotaPopustov += film.popust;
        });

        odgovor.setHeader("Content-Type", "text/xml");
        odgovor.render("eslog", {
          vizualiziraj: zahteva.params.oblika == "html",
          postavkeRacuna: filmi,
          povzetekRacuna: povzetek,
          stranka: stranka,
          layout: null,
        });
      }
    });
  });
});

// Privzeto izpiši račun v HTML obliki
streznik.get("/izpisiRacun", (zahteva, odgovor) => {
  odgovor.redirect("/izpisiRacun/html");
});

// Vrni prvo pojavitev sorodnika z enakim priimkom
streznik.get("/najdi_sorodnika/:priimek", (zahteva, odgovor) => {
  let priimek = zahteva.params.priimek;
  najdiStrankoPoPriimku(priimek, (napaka, stranka) => {
    if (napaka) {
      console.log(napaka);
      odgovor.end();
    } else {
      odgovor.send(stranka);
    }
  });
});

let textOdgovor = "";

// Registracija novega uporabnika
streznik.post("/prijava", (zahteva, odgovor, next) => {
  const form = formidable({ multiples: true });

  form.parse(zahteva, (err, fields, files) => {
    if (err) {
      next(err);
      return;
    }
    let fieldsInput = fields;

    let podobodnoStranko;
    let vlez = {
      ime: fieldsInput.FirstName.toUpperCase(),
      priimek: fieldsInput.LastName.toUpperCase(),
    };

    najdiPodobnoStranko(vlez, (napaka, stranka) => {
      podobodnoStranko = stranka;

      if (
        fieldsInput.FirstName != "" &&
        fieldsInput.LastName != "" &&
        fieldsInput.Addres != "" &&
        fieldsInput.City != "" &&
        fieldsInput.State != "" &&
        fieldsInput.PostalCode != "" &&
        fieldsInput.Phone != "" &&
        fieldsInput.Fax != "" &&
        fieldsInput.CompanyType != null &&
        fieldsInput.Email != "" &&
        podobodnoStranko == null
      ) {
        pb.run(
          "INSERT INTO Customer \
       (FirstName, LastName, Company, Address, City, State, \
        Country, PostalCode, Phone, Fax, Email, SupportRepId) \
     VALUES \
       ($fn, $ln, $com, $addr, $city, $state, $country, $pc, $phone, \
        $fax, $email, $sri)",
          {
            $fn: fieldsInput.FirstName,
            $ln: fieldsInput.LastName,
            $com: fieldsInput.CompanyString + fieldsInput.CompanyType,
            $addr: fieldsInput.Addres,
            $city: fieldsInput.City,
            $state: fieldsInput.State,
            $country: fieldsInput.Country,
            $pc: fieldsInput.PostalCode,
            $phone: fieldsInput.Phone,
            $fax: fieldsInput.Fax,
            $email: fieldsInput.Email,
            $sri: 8,
          },
          (napaka) => {
            odgovor.end();
          }
        );
        textOdgovor =
          "Nova stranka " +
          fieldsInput.FirstName +
          " " +
          fieldsInput.LastName +
          " je bila uspešno dodana.";
        odgovor.redirect("/prijava");
      } else {
        textOdgovor =
          "Prišlo je do napake pri dodajanju nove stranke. Prosim, preverite vnesene podatke in poskusite znova.";
        odgovor.redirect("/prijava");
      }
    });
  });
});

// Prikaz strani za prijavo
streznik.get("/prijava", (zahteva, odgovor) => {
  vrniStranke((napaka1, stranke) => {
    vrniRacune((napaka2, racuni) => {
      for (let i = 0; i < stranke.length; i++) stranke[i].stRacunov = 0;

      for (let i = 0; i < racuni.length; i++)
        filmiIzRacuna(racuni[i].InvoiceId, (napaka, vrstice) => {});
      // stranke.sort((a, b) => {
      //   return a.Country - b.Country;
      // });
      let sortedStudents = stranke.sort((a, b) =>
        a.Country < b.Country
          ? -1
          : b.Country > a.Country
          ? 1
          : 0
      );

      for(let i=stranke.length-1; i-1>0; --i){
          if(stranke[i].Country === stranke[i-1].Country && stranke[i].Country!=null){
            let dolzina = stranke[i].Country.length;
            stranke[i].Country="";
            for(let j=0; j<dolzina; ++j){
              stranke[i].Country += "&nbsp;";
            }
            //stranke[i].Country = dolzina * "&nbsp;";   
          }

      }
      //console.log(sortedStudents);
      odgovor.render("prijava", {
        sporocilo: textOdgovor,
        prijavniGumb: "Prijava stranke",
        podnaslov: "Prijavna stran",
        seznamStrank: sortedStudents,
        seznamRacunov: racuni,
        podjetja: tipiPodjetij,
      });
    });
  });
});

// Prijava ali odjava stranke
streznik.get("/prijavaOdjava/:strankaId", (zahteva, odgovor) => {
  if (zahteva.get("referer").endsWith("/prijava")) {
    // Izbira stranke oz. prijava
    zahteva.session.trenutnaStranka = parseInt(zahteva.params.strankaId, 10);
    odgovor.redirect("/");
  } else {
    // Odjava stranke
    delete zahteva.session.trenutnaStranka;
    delete zahteva.session.kosarica;
    odgovor.redirect("/prijava");
  }
});

// Prikaz seznama filmov na strani
streznik.get("/podroben-seznam-filmov", (zahteva, odgovor) => {
  vrniSeznamFilmov((napaka, vrstice) => {
    if (napaka) odgovor.sendStatus(500);
    else odgovor.send(vrstice);
  });
});

streznik.get("/filmi-racuna/:racunId", (zahteva, odgovor) => {
  let racunId = parseInt(zahteva.params.racunId, 10);
  filmiIzRacuna(racunId, (napaka, vrstice) => {
    odgovor.send(vrstice);
  });
});

streznik.get("/filtri", (zahteva, odgovor) => {
  vrniSeznamFilmov((napaka, vrstice) => {
    if (napaka) {
      odgovor.sendStatus(500);
    } else {
      let filtri = {};
      let zanri = new Set();
      let leta = new Set();

      for (let i = 0; i < vrstice.length; i++) {
        let seznamZanrov = vrstice[i].zanri.split(",");
        seznamZanrov.forEach(function (zanr, i) {
          zanri.add(zanr);
        });

        leta.add(vrstice[i].datumIzdaje.split("-")[0]);
      }

      odgovor.send({
        filmi: vrstice,
        sifranti: {
          leto: Array.from(leta).sort(),
          zanr: Array.from(zanri).sort(),
        },
      });
    }
  });
});

streznik.listen(process.env.PORT, () => {
  console.log(`Strežnik je pognan na vratih ${process.env.PORT}!`);
});
