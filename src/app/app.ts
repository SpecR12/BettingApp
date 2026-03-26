import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, combineLatest, of, timer } from 'rxjs';
import { catchError, retry, shareReplay, switchMap } from 'rxjs/operators';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, NgOptimizedImage],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {

  // ==========================================
  // 🔒 STARE AUTENTIFICARE
  // ==========================================
  isAuthLoading: boolean = false;
  isLoggedIn: boolean = false;
  authMode: 'login' | 'register' | 'reset' = 'login';
  authError: string = '';
  authData = { email: '', parola: '', codInvitatie: '' };
  token: string | null = null;
  private API_URL = 'https://bettingapp-2uni.onrender.com/api';

  // ==========================================
  // 📊 STARE APLICAȚIE
  // ==========================================
  ecranCurent: 'radar' | 'portofoliu' | 'arbitraj' = 'radar';
  isDarkMode = false;
  bugetTotal = 100;
  strategieKelly: number = 0.25;
  limitaPariuBanca: number = 5.0;

  oportunitati: any = null;
  isLoadingRadar: boolean = true;
  private toateMeciurile: any[] = [];
  listaSureBets: any[] = [];

  sportSelectat = 'Toate';
  ligaSelectata = 'Toate';
  sporturiDisponibile: string[] = ['Toate'];
  ligiDisponibile: string[] = ['Toate'];

  filtruSport$ = new BehaviorSubject<string>('Toate');
  filtruLiga$ = new BehaviorSubject<string>('Toate');
  valoareFiltruEV: number = 0;
  filtruEV$ = new BehaviorSubject<number>(0);

  listaPariuri: any[] = [];
  totalMizat: number = 0;
  profitEstimat: number = 0;
  profitRealizat: number = 0;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.token = sessionStorage.getItem('auth_token');
    if (this.token) {
      this.isLoggedIn = true;
      this.initApp();
    }
    const temaSalvata = localStorage.getItem('tema_pariuri');
    if (temaSalvata === 'dark') {
      this.isDarkMode = true;
      requestAnimationFrame(() => {
        document.body.classList.add('dark-theme-global');
      });
    }
  }

  // ==========================================
  // 🔑 LOGICĂ AUTHENTIFICARE
  // ==========================================

  getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${this.token}`
      })
    };
  }

  setAuthMode(mode: 'login' | 'register' | 'reset') {
    this.authMode = mode;
    this.authError = '';
    this.authData.parola = '';
    this.authData.codInvitatie = '';
  }

  onSubmitAuth() {
    if (this.isAuthLoading) return;

    this.authError = '';
    this.isAuthLoading = true;

    let url = '';
    if (this.authMode === 'login') url = `${this.API_URL}/auth/login`;
    else if (this.authMode === 'register') url = `${this.API_URL}/auth/register`;
    else if (this.authMode === 'reset') url = `${this.API_URL}/auth/reset-password`;

    const sleepTimeoutWarning = setTimeout(() => {
      if (this.isAuthLoading) {
        this.authError = '⏳ Serverul se pornește (mod de hibernare). Te rugăm să aștepți până la 50 de secunde...';
        this.cdr.detectChanges();
      }
    }, 4000);

    this.http.post<any>(url, this.authData).subscribe({
      next: (res) => {
        clearTimeout(sleepTimeoutWarning);
        this.isAuthLoading = false;
        this.authError = '';

        if (this.authMode === 'login') {
          this.token = res.token;
          sessionStorage.setItem('auth_token', res.token);
          this.isLoggedIn = true;
          this.initApp();
        }
        else if (this.authMode === 'register') {
          alert('✅ Cont creat cu succes! Te rugăm să te conectezi.');
          this.authMode = 'login';
          this.authData.parola = '';
          this.authData.codInvitatie = '';
        }
        else if (this.authMode === 'reset') {
          alert('✅ Parola a fost schimbată cu succes! Te poți conecta acum.');
          this.authMode = 'login';
          this.authData.parola = '';
          this.authData.codInvitatie = '';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(sleepTimeoutWarning);
        this.isAuthLoading = false;
        this.authError = err.error?.message || '❌ Eroare de rețea. Serverul este oprit sau indisponibil.';
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    sessionStorage.removeItem('auth_token');
    this.token = null;
    this.isLoggedIn = false;
    this.listaPariuri = [];
    this.oportunitati = null;
    this.authData = { email: '', parola: '', codInvitatie: '' };
  }

  initApp() {
    this.incarcaPortofoliu(true);
    const tabSalvat = sessionStorage.getItem('tabCurent') as 'radar' | 'portofoliu' | 'arbitraj';
    if (tabSalvat) {
      this.ecranCurent = tabSalvat;
    } else {
      this.ecranCurent = 'radar';
    }
  }

  // ==========================================
  // 🔄 FUNCȚII API SECURIZATE
  // ==========================================

  incarcaPortofoliu(initRadarApoi: boolean = false) {
    this.http.get<any>(`${this.API_URL}/pariuri`, this.getHttpOptions()).subscribe({
      next: (res) => {
        this.listaPariuri = res.data || res;
        this.calculeazaStatistici();
        this.sincronizeazaButoaneRadar();

        if (initRadarApoi) {
          this.incarcaRadar();
        }
      },
      error: (err) => {
        console.error('Eroare la încărcarea portofoliului:', err);
        if (err.status === 401) this.logout(); // Token expirat/invalid
        else if (initRadarApoi) this.incarcaRadar();
      }
    });
  }

  incarcaRadar() {
    this.isLoadingRadar = true;

    const fetchDate$ = timer(0, 60000).pipe(
      switchMap(() => this.http.get<any>(`${this.API_URL}/value-bets`, this.getHttpOptions()).pipe(
        retry(2),
        catchError(error => {
          console.error('Eroare rețea Radar:', error);
          if (error.status === 401) this.logout();
          return of({ data: [], sure_bets: [] });
        })
      )),
      shareReplay(1)
    );

    combineLatest([fetchDate$, this.filtruSport$, this.filtruLiga$, this.filtruEV$]).subscribe({
      next: ([response, sport, liga, evMinim]) => {
        if (response && response.data) {
          this.toateMeciurile = response.data;
          this.listaSureBets = response.sure_bets || [];

          const sporturi = new Set<string>();
          response.data.forEach((m: any) => sporturi.add(m.categorie));
          this.sporturiDisponibile = ['Toate', ...Array.from(sporturi).sort()];

          let filtrate = response.data;
          if (sport !== 'Toate') filtrate = filtrate.filter((m: any) => m.categorie === sport);
          if (liga !== 'Toate') filtrate = filtrate.filter((m: any) => m.liga === liga);
          filtrate = filtrate.filter((m: any) => m.avantajEV >= evMinim);

          this.oportunitati = {
            ...response,
            total_oportunitati: filtrate.length,
            data: filtrate
          };

          this.sincronizeazaButoaneRadar();
          this.isLoadingRadar = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Eroare generală radar:', err);
        this.isLoadingRadar = false;
        this.cdr.detectChanges();
      }
    });
  }

  salveazaInPortofoliu(meci: any) {
    const sumaCalculata = this.calculeazaSumaPariu(meci.kellyRecomandat);
    const mizaProcent = this.calculeazaProcentAjustat(meci.kellyRecomandat);

    const dateDeSalvat = {
      meci: `${meci.echipaGazda} vs ${meci.echipaOaspete}`,
      competitie: meci.liga,
      pronostic: meci.pronostic,
      cota: meci.cotaGasita,
      agentie: meci.agentie,
      avantajEV: meci.avantajEV,
      mizaRecomandata: sumaCalculata,
      mizaProcent: mizaProcent,
      ai_decizie: meci.ai_decizie,
      ai_motiv: meci.ai_motiv
    };

    this.http.post<any>(`${this.API_URL}/save-bet`, dateDeSalvat, this.getHttpOptions()).subscribe({
      next: (response) => {
        meci.salvat = true;
        const pariuNou = response.data || response;
        this.listaPariuri.unshift(pariuNou);
        this.calculeazaStatistici();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Eroare la salvare:', err);
        if (err.status === 401) this.logout();
        else alert('❌ Eroare la salvarea biletului în baza de date.');
      }
    });
  }

  schimbaStatus(pariuId: string, statusNou: string) {
    this.http.patch(`${this.API_URL}/pariuri/${pariuId}/status`, { status: statusNou }, this.getHttpOptions()).subscribe({
      next: () => {
        const pariuModificat = this.listaPariuri.find(p => p._id === pariuId);
        if (pariuModificat) {
          pariuModificat.status = statusNou;
        }

        this.calculeazaStatistici();
        if (statusNou === 'Anulat') {
          this.sincronizeazaButoaneRadar();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 401) this.logout();
        else alert('❌ Eroare la salvarea statusului pe server!');
      }
    });
  }

  // ==========================================
  // ⚙️ FUNCȚII AUXILIARE / UI
  // ==========================================

  sincronizeazaButoaneRadar() {
    if (!this.oportunitati || !this.oportunitati.data) return;

    this.oportunitati.data.forEach((meci: any) => {
      const meciFormultat = `${meci.echipaGazda} vs ${meci.echipaOaspete}`;
      meci.salvat = this.listaPariuri.some(pariu =>
        pariu.meci === meciFormultat &&
        pariu.pronostic === meci.pronostic &&
        pariu.status !== 'Anulat'
      );
    });
    this.cdr.detectChanges();
  }

  schimbaEcran(ecran: 'radar' | 'portofoliu' | 'arbitraj') {
    this.ecranCurent = ecran;
    sessionStorage.setItem('tabCurent', ecran);
  }

  schimbaSport(event: any) {
    const sportAles = event.target.value;
    this.sportSelectat = sportAles;
    this.filtruSport$.next(sportAles);

    if (sportAles === 'Toate') {
      this.ligiDisponibile = ['Toate'];
    } else {
      const ligi = new Set<string>();
      this.toateMeciurile
        .filter(m => m.categorie === sportAles)
        .forEach(m => ligi.add(m.liga));
      this.ligiDisponibile = ['Toate', ...Array.from(ligi).sort()];
    }

    this.ligaSelectata = 'Toate';
    this.filtruLiga$.next('Toate');
  }

  schimbaLiga(event: any) {
    this.ligaSelectata = event.target.value;
    this.filtruLiga$.next(this.ligaSelectata);
  }

  schimbaEV(event: any) {
    const valoare = parseFloat(event.target.value) || 0;
    this.valoareFiltruEV = valoare;
    this.filtruEV$.next(valoare);
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      localStorage.setItem('tema_pariuri', 'dark');
      requestAnimationFrame(() => {
        document.body.classList.add('dark-theme-global');
      });
    } else {
      localStorage.setItem('tema_pariuri', 'light');
      requestAnimationFrame(() => {
        document.body.classList.remove('dark-theme-global');
      });
    }
  }

  protected valideazaBuget(valoareNoua: number) {
    if (valoareNoua < 0) this.bugetTotal = 0;
  }

  calculeazaSumaPariu(fullKellyProcent: number): number {
    let procentAjustat = fullKellyProcent * this.strategieKelly;
    if (procentAjustat > this.limitaPariuBanca) procentAjustat = this.limitaPariuBanca;
    return (this.bugetTotal * procentAjustat) / 100;
  }

  calculeazaProcentAjustat(fullKellyProcent: number): number {
    let procentAjustat = fullKellyProcent * this.strategieKelly;
    if (procentAjustat > this.limitaPariuBanca) procentAjustat = this.limitaPariuBanca;
    return procentAjustat;
  }

  calculeazaMizaArbitraj(cota: number, toatePariurileMeciului: any[]): number {
    let marjaTotalaInversa = 0;
    toatePariurileMeciului.forEach(p => marjaTotalaInversa += (1 / p.cota));
    return this.bugetTotal / (cota * marjaTotalaInversa);
  }

  getLinkAgentie(numeAgentie: string): string {
    const nume = numeAgentie.toLowerCase();
    if (nume.includes('888') || nume.includes('sport888')) return 'https://www.888sport.ro';
    if (nume.includes('unibet')) return 'https://www.unibet.ro';
    if (nume.includes('betano')) return 'https://ro.betano.com';
    if (nume.includes('betfair')) return 'https://www.betfair.ro';
    if (nume.includes('superbet')) return 'https://superbet.ro';
    if (nume.includes('maxbet')) return 'https://www.maxbet.ro';
    return 'https://www.google.com/search?q=' + numeAgentie + ' pariuri';
  }

  calculeazaStatistici() {
    if (!this.listaPariuri) return;

    this.totalMizat = this.listaPariuri.reduce((sum, pariu) => sum + (pariu.mizaRecomandata || 0), 0);
    this.profitEstimat = this.listaPariuri.reduce((sum, pariu) => sum + ((pariu.mizaRecomandata || 0) * ((pariu.avantajEV || 0) / 100)), 0);
    this.profitRealizat = this.listaPariuri.reduce((sum, pariu) => {
      if (pariu.status === 'Castigat') return sum + ((pariu.mizaRecomandata || 0) * (pariu.cota || 1) - (pariu.mizaRecomandata || 0));
      else if (pariu.status === 'Pierdut') return sum - (pariu.mizaRecomandata || 0);
      return sum;
    }, 0);
  }
}
