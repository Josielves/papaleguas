import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CarFront,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  FileCheck2,
  Gift,
  History,
  LockKeyhole,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Navigation,
  Plus,
  Radar,
  Route,
  Search,
  ShieldCheck,
  Star,
  Sun,
  User,
  UserCheck,
  WalletCards,
  X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import "./styles.css";

const regionPrices = {
  same: 7,
  center: 9,
  adjacent: 12,
  extreme: 16
};

const regionOptions = ["Centro", "Norte", "Sul", "Leste", "Oeste"];
const extremePairs = new Set(["Norte-Sul", "Sul-Norte", "Leste-Oeste", "Oeste-Leste"]);

function calculateRegionFare(originRegion, destinationRegion) {
  if (originRegion === destinationRegion) return regionPrices.same;
  if (originRegion === "Centro" || destinationRegion === "Centro") return regionPrices.center;
  if (extremePairs.has(`${originRegion}-${destinationRegion}`)) return regionPrices.extreme;
  return regionPrices.adjacent;
}

const initialRoutes = [
  {
    id: 1,
    driver: "Marina Costa",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
    rating: 4.9,
    vehicle: "Onix Plus prata",
    plate: "BRA-2E18",
    from: "Jardim America",
    originRegion: "Norte",
    through: ["Centro", "Vila Nova"],
    to: "Distrito Industrial",
    destinationRegion: "Sul",
    times: ["06:40", "07:20", "18:10"],
    totalSeats: 4,
    seats: 3,
    price: calculateRegionFare("Norte", "Sul"),
    eta: "8 min",
    inRoute: true,
    phone: "(11) 98888-1001",
    pixKey: "marina@papaleguas.com"
  },
  {
    id: 2,
    driver: "Rafael Nunes",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
    rating: 4.8,
    vehicle: "Spin branca",
    plate: "PPL-7A40",
    from: "Parque das Flores",
    originRegion: "Oeste",
    through: ["Santa Rita", "Rodoviaria"],
    to: "Centro",
    destinationRegion: "Centro",
    times: ["07:00", "12:15", "17:50"],
    totalSeats: 6,
    seats: 5,
    price: calculateRegionFare("Oeste", "Centro"),
    eta: "12 min",
    inRoute: false,
    phone: "(11) 97777-2202",
    pixKey: "11977772202"
  },
  {
    id: 3,
    driver: "Bianca Torres",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80",
    rating: 5.0,
    vehicle: "Kwid verde",
    plate: "FIX-9C21",
    from: "Cidade Alta",
    originRegion: "Leste",
    through: ["Mercado", "Faculdade"],
    to: "Hospital Municipal",
    destinationRegion: "Oeste",
    times: ["05:55", "13:30", "22:10"],
    totalSeats: 4,
    seats: 2,
    price: calculateRegionFare("Leste", "Oeste"),
    eta: "5 min",
    inRoute: true,
    phone: "(11) 96666-3303",
    pixKey: "bianca@papaleguas.com"
  }
];

const driverRoutes = [
  { name: "Jardim America -> Distrito Industrial", occupancy: 70, revenue: "R$ 216", next: "06:40" },
  { name: "Centro -> Vila Nova", occupancy: 92, revenue: "R$ 138", next: "12:20" },
  { name: "Santa Rita -> Rodoviaria", occupancy: 58, revenue: "R$ 81", next: "17:40" }
];

const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80";

function formatUser(profile, sessionUser) {
  const role = profile?.role || sessionUser?.user_metadata?.role || "passenger";
  const name = profile?.full_name || sessionUser?.user_metadata?.full_name || sessionUser?.email || "Usuario";

  return {
    id: profile?.id || sessionUser?.id,
    authUserId: sessionUser?.id,
    name,
    email: sessionUser?.email,
    role,
    avatar: profile?.avatar_url || defaultAvatar,
    phone: profile?.phone || sessionUser?.user_metadata?.phone || "",
    pixKey: profile?.pix_key || sessionUser?.user_metadata?.pix_key || "",
    badge: role === "driver" ? "Motorista verificado" : "Cliente Papaleguas",
    walletLabel: role === "driver" ? "Saldo" : "Fidelidade",
    walletValue: role === "driver" ? "R$ 0,00" : "0 pontos"
  };
}

function App() {
  const [theme, setTheme] = useState("dark");
  const [view, setView] = useState("passenger");
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [query, setQuery] = useState("");
  const [routesState, setRoutesState] = useState(initialRoutes);
  const [selectedRouteId, setSelectedRouteId] = useState(initialRoutes[0].id);
  const [reserved, setReserved] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Localizacao nao ativada");
  const [menuOpen, setMenuOpen] = useState(false);

  const selected = routesState.find((route) => route.id === selectedRouteId) || routesState[0];

  const filteredRoutes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return routesState;
    return routesState.filter((route) =>
      [route.from, route.to, route.driver, route.vehicle, ...route.through].join(" ").toLowerCase().includes(term)
    );
  }, [query, routesState]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      setAuthError("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.");
      return undefined;
    }

    loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user);
        return;
      }

      setCurrentUser(null);
      setAuthReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  function openSession(user) {
    setCurrentUser(user);
    setView(user.role === "driver" ? "driver" : "passenger");
    setMenuOpen(false);
    setAuthError("");
    setAuthMessage("");
  }

  async function loadSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setAuthError(error.message);
      setAuthReady(true);
      return;
    }

    if (data.session?.user) {
      await loadUserProfile(data.session.user);
    } else {
      setAuthReady(true);
    }
  }

  async function loadUserProfile(sessionUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", sessionUser.id)
      .maybeSingle();

    openSession(formatUser(profile, sessionUser));
    setAuthReady(true);
  }

  async function handleLogin({ email, password }) {
    if (!isSupabaseConfigured) {
      setAuthError("Supabase ainda nao esta configurado.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      setAuthError("Usuario ou senha invalidos.");
      setAuthMessage("");
      return;
    }

    await loadUserProfile(data.user);
  }

  async function handleSignup({ name, email, password, role }) {
    if (!isSupabaseConfigured) {
      setAuthError("Supabase ainda nao esta configurado.");
      return;
    }

    if (!name.trim() || !email.trim() || password.length < 6) {
      setAuthError("Preencha nome, usuario e uma senha com pelo menos 6 caracteres.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          role
        }
      }
    });

    if (error) {
      setAuthError(error.message);
      setAuthMessage("");
      return;
    }

    setAuthError("");

    if (data.session?.user) {
      await loadUserProfile(data.session.user);
      return;
    }

    setAuthMessage("Cadastro criado. Confirme seu email e depois faca login.");
  }

  async function handleLogout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }

    setCurrentUser(null);
    setView("passenger");
    setReserved(false);
    setMenuOpen(false);
    setAuthMessage("");
  }

  if (!authReady) {
    return (
      <main className={`app ${theme}`}>
        <section className="auth-layout">
          <div className="auth-brand">
            <div className="brand-mark">
              <Navigation size={24} />
            </div>
            <span>Papaleguas</span>
            <h1>Carregando sua sessao</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className={`app ${theme}`}>
        <AuthScreen
          error={authError}
          message={authMessage}
          onLogin={handleLogin}
          onSignup={handleSignup}
          theme={theme}
          setTheme={setTheme}
        />
      </main>
    );
  }

  return (
    <main className={`app ${theme}`}>
      <Topbar
        currentUser={currentUser}
        onLogout={handleLogout}
        theme={theme}
        setTheme={setTheme}
        view={view}
        setView={setView}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <section className="shell">
        <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
          <ProfilePanel user={currentUser} />
          {currentUser.role === "passenger" && (
            <NavButton active={view === "passenger"} icon={Search} label="Cliente" onClick={() => setView("passenger")} />
          )}
          {currentUser.role === "driver" && (
            <NavButton active={view === "driver"} icon={CarFront} label="Motorista" onClick={() => setView("driver")} />
          )}
          <NavButton active={view === "safety"} icon={ShieldCheck} label="Seguranca" onClick={() => setView("safety")} />
          <NavButton active={view === "profile"} icon={User} label="Perfil" onClick={() => setView("profile")} />
          {currentUser.role === "driver" && (
            <NavButton active={view === "finance"} icon={WalletCards} label="Ganhos" onClick={() => setView("finance")} />
          )}
          <div className="sidebar-footer">
            <div>
              <span>{currentUser.walletLabel}</span>
              <strong>{currentUser.walletValue}</strong>
            </div>
            {currentUser.role === "driver" ? <WalletCards size={18} /> : <Gift size={18} />}
          </div>
        </aside>

        <div className="workspace">
          {view === "passenger" && currentUser.role === "passenger" && (
            <PassengerArea
              query={query}
              setQuery={setQuery}
              routes={filteredRoutes}
              selected={selected}
              setSelected={(route) => {
                setSelectedRouteId(route.id);
                setReserved(false);
                setChatOpen(false);
              }}
              reserved={reserved}
              onReserve={() => {
                if (selected.seats <= 0) return;
                setRoutesState((items) =>
                  items.map((route) => (route.id === selected.id ? { ...route, seats: Math.max(route.seats - 1, 0) } : route))
                );
                setReserved(true);
                setChatOpen(true);
              }}
              chatOpen={chatOpen}
              setChatOpen={setChatOpen}
              userLocation={userLocation}
              locationStatus={locationStatus}
              requestLocation={() => requestLocation(setUserLocation, setLocationStatus)}
            />
          )}
          {view === "driver" && currentUser.role === "driver" && (
            <DriverArea
              user={currentUser}
              onCreateRoute={(route) => {
                const newRoute = {
                  ...route,
                  id: Date.now(),
                  driver: currentUser.name,
                  avatar: currentUser.avatar,
                  rating: 5,
                  vehicle: "Veiculo cadastrado",
                  plate: "PPL-2026",
                  seats: Number(route.totalSeats),
                  totalSeats: Number(route.totalSeats),
                  eta: "ao vivo",
                  phone: currentUser.phone || "Contato pendente",
                  pixKey: currentUser.pixKey || "Pix nao cadastrado"
                };
                setRoutesState((items) => [newRoute, ...items]);
              }}
            />
          )}
          {view === "safety" && <SafetyArea selected={selected} role={currentUser.role} />}
          {view === "profile" && <ProfileArea user={currentUser} onSave={handleProfileSave} />}
          {view === "finance" && currentUser.role === "driver" && <FinanceArea />}
        </div>
      </section>
    </main>
  );

  async function handleProfileSave(nextProfile) {
    const nextUser = {
      ...currentUser,
      ...nextProfile,
      avatar: nextProfile.avatar || currentUser.avatar,
      pixKey: nextProfile.pixKey,
      walletValue: currentUser.walletValue
    };

    setCurrentUser(nextUser);

    if (isSupabaseConfigured && currentUser.id) {
      await supabase
        .from("profiles")
        .update({
          full_name: nextUser.name,
          phone: nextUser.phone,
          pix_key: nextUser.pixKey,
          avatar_url: nextUser.avatar
        })
        .eq("id", currentUser.id);
    }
  }
}

function requestLocation(setUserLocation, setLocationStatus) {
  if (!navigator.geolocation) {
    setLocationStatus("Geolocalizacao nao suportada neste navegador");
    return;
  }

  setLocationStatus("Solicitando localizacao...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      setUserLocation(coords);
      setLocationStatus(`Localizacao ativa: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    },
    () => setLocationStatus("Permissao de localizacao negada"),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function AuthScreen({ error, message, onLogin, onSignup, theme, setTheme }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("passenger");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitAuth(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "login") {
        await onLogin({ email, password });
        return;
      }

      await onSignup({ name, email, password, role });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-brand">
        <div className="brand-mark">
          <Navigation size={24} />
        </div>
        <span>Papaleguas</span>
        <h1>Entre com usuario e senha para acessar sua conta</h1>
        <p>Cliente reserva assentos. Motorista cria rotas, controla vagas e acompanha ganhos.</p>
      </div>

      <form className="auth-panel" onSubmit={submitAuth}>
        <div className="auth-topline">
          <div>
            <span>Autenticacao</span>
            <h2>{mode === "login" ? "Acessar conta" : "Criar conta"}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>

        <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Cadastrar</button>
        </div>

        {mode === "signup" && (
          <label className="auth-field">
            <span>Nome completo</span>
            <div>
              <User size={18} />
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" />
            </div>
          </label>
        )}

        <label className="auth-field">
          <span>Usuario</span>
          <div>
            <User size={18} />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" />
          </div>
        </label>

        <label className="auth-field">
          <span>Senha</span>
          <div>
            <LockKeyhole size={18} />
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" />
          </div>
        </label>

        {mode === "signup" && (
          <div className="role-picker">
            <button type="button" className={role === "passenger" ? "active" : ""} onClick={() => setRole("passenger")}>
              <Search size={17} />
              Cliente
            </button>
            <button type="button" className={role === "driver" ? "active" : ""} onClick={() => setRole("driver")}>
              <CarFront size={17} />
              Motorista
            </button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-message">{message}</div>}

        <button className="primary-button" type="submit" disabled={submitting}>
          <LogIn size={18} />
          {submitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </section>
  );
}

function Topbar({ currentUser, onLogout, theme, setTheme, view, setView, menuOpen, setMenuOpen }) {
  const homeView = currentUser.role === "driver" ? "driver" : "passenger";

  return (
    <header className="topbar">
      <button className="icon-button mobile-only" aria-label="Abrir menu" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <div className="brand" onClick={() => setView(homeView)} role="button" tabIndex="0">
        <div className="brand-mark">
          <Navigation size={22} />
        </div>
        <div>
          <strong>Papaleguas</strong>
          <span>{currentUser.role === "driver" ? "conta motorista" : "conta cliente"}</span>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="mode-switch" aria-label="Alternar area">
          <button className={view === homeView ? "active" : ""} onClick={() => setView(homeView)}>
            {currentUser.role === "driver" ? "Motorista" : "Cliente"}
          </button>
          <button className={view === "safety" ? "active" : ""} onClick={() => setView("safety")}>Seguranca</button>
        </div>
        <button className="icon-button" aria-label="Notificacoes">
          <Bell size={19} />
        </button>
        <button className="icon-button" aria-label="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button className="icon-button" aria-label="Sair" onClick={onLogout}>
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}

function ProfilePanel({ user }) {
  return (
    <div className="profile-panel">
      <img src={user.avatar} alt={`Perfil de ${user.name}`} />
      <div>
        <span>{user.badge}</span>
        <strong>{user.name}</strong>
      </div>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function PassengerArea({
  query,
  setQuery,
  routes,
  selected,
  setSelected,
  reserved,
  onReserve,
  chatOpen,
  setChatOpen,
  userLocation,
  locationStatus,
  requestLocation
}) {
  return (
    <div className="view-grid passenger-grid">
      <section className="panel search-panel">
        <div className="section-title">
          <div>
            <span>Area do Cliente</span>
            <h1>Reserve um assento em rotas de bairro</h1>
          </div>
          <button className="ghost-button">
            <CalendarClock size={17} />
            Hoje
            <ChevronDown size={16} />
          </button>
        </div>

        <div className="location-card">
          <div>
            <span>API de localizacao</span>
            <strong>{locationStatus}</strong>
          </div>
          <button className="ghost-button" onClick={requestLocation}>
            <MapPin size={16} />
            Usar minha localizacao
          </button>
        </div>

        <div className="search-box">
          <Search size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por bairro, destino ou motorista" />
        </div>

        <div className="quick-filters">
          <button>Centro</button>
          <button>Faculdade</button>
          <button>Hospital</button>
          <button>Distrito</button>
        </div>

        <div className="route-list">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} selected={selected.id === route.id} onSelect={() => setSelected(route)} />
          ))}
        </div>
      </section>

      <section className="map-panel">
        <RouteMap route={selected} />
      </section>

      <section className="panel booking-panel">
        <DriverSummary route={selected} />
        <div className="booking-detail">
          <InfoLine icon={MapPin} label="Saida" value={selected.from} />
          <InfoLine icon={Radar} label="Regiao de origem" value={selected.originRegion} />
          <InfoLine icon={Route} label="Passa por" value={selected.through.join(", ")} />
          <InfoLine icon={Navigation} label="Destino" value={selected.to} />
          <InfoLine icon={Radar} label="Regiao de destino" value={selected.destinationRegion} />
          <InfoLine icon={Clock3} label="Horarios" value={selected.times.join(" / ")} />
          {userLocation && <InfoLine icon={MapPin} label="Sua localizacao" value={`${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`} />}
        </div>
        <div className="payment-row">
          <div>
            <span>Valor por regiao via Pix</span>
            <strong>R$ {selected.price},00</strong>
          </div>
          <CreditCard size={22} />
        </div>
        <div className="pix-card">
          <span>Chave Pix do motorista</span>
          <strong>{selected.pixKey}</strong>
        </div>
        <button className={`primary-button ${reserved ? "done" : ""}`} disabled={selected.seats <= 0} onClick={onReserve}>
          {reserved ? <Check size={18} /> : <Plus size={18} />}
          {reserved ? "Vaga reservada e chat liberado" : selected.seats <= 0 ? "Sem vagas" : "Reservar assento"}
        </button>
        <div className="mini-actions">
          <button disabled={!reserved} onClick={() => setChatOpen(true)}><MessageCircle size={16} />Chat</button>
          <button><History size={16} />Historico</button>
          <button><Star size={16} />Avaliar</button>
        </div>
        {chatOpen && reserved && <ChatBox route={selected} />}
      </section>
    </div>
  );
}

function RouteCard({ route, selected, onSelect }) {
  return (
    <button className={`route-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="route-card-main">
        <img src={route.avatar} alt={`Motorista ${route.driver}`} />
        <div>
          <strong>{route.from} <ArrowRight size={14} /> {route.to}</strong>
          <span>{route.driver} - {route.vehicle}</span>
        </div>
      </div>
      <div className="route-card-meta">
        <span><Star size={14} />{route.rating}</span>
        <span>{route.seats} vagas</span>
        <span>{route.inRoute ? "Em rota agora" : "Programada"}</span>
        <strong>R$ {route.price}</strong>
      </div>
    </button>
  );
}

function ChatBox({ route }) {
  const [messages, setMessages] = useState([
    { from: "Motorista", text: `Ola! Estou na rota ${route.from} -> ${route.to}.` },
    { from: "Sistema", text: "Chat liberado porque o assento foi reservado." }
  ]);
  const [text, setText] = useState("");

  function sendMessage() {
    if (!text.trim()) return;
    setMessages((items) => [...items, { from: "Voce", text: text.trim() }]);
    setText("");
  }

  return (
    <div className="chat-box">
      <div className="chat-header">
        <strong>Chat com {route.driver}</strong>
        <span>{route.phone}</span>
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div className="chat-message" key={`${message.from}-${index}`}>
            <span>{message.from}</span>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Digite sua mensagem" />
        <button className="ghost-button" onClick={sendMessage}>Enviar</button>
      </div>
    </div>
  );
}

function RouteMap({ route }) {
  return (
    <div className="map-surface">
      <div className="map-header">
        <div>
          <span>Mapa em tempo real</span>
          <strong>{route.eta} de voce</strong>
        </div>
        <button className="icon-button" aria-label="Centralizar rota">
          <Radar size={19} />
        </button>
      </div>
      <div className="map-grid">
        <div className="route-line">
          <span className="pin start" />
          <span className="pin mid one" />
          <span className="pin mid two" />
          <span className="pin end" />
        </div>
        <div className="vehicle-dot">
          <CarFront size={18} />
        </div>
        <div className="district-label label-a">{route.from}</div>
        <div className="district-label label-b">{route.through[0]}</div>
        <div className="district-label label-c">{route.to}</div>
      </div>
    </div>
  );
}

function DriverSummary({ route }) {
  return (
    <div className="driver-summary">
      <img src={route.avatar} alt={`Foto de ${route.driver}`} />
      <div>
        <span>Motorista verificado</span>
        <h2>{route.driver}</h2>
        <p>{route.vehicle} - {route.plate}</p>
        <div className="rating-row">
          <Star size={15} />
          <strong>{route.rating}</strong>
          <span>{route.seats} vagas restantes</span>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }) {
  return (
    <div className="info-line">
      <Icon size={18} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DriverArea({ user, onCreateRoute }) {
  const [draft, setDraft] = useState({
    from: "Jardim America",
    originRegion: "Norte",
    through: "Centro, Vila Nova",
    to: "Distrito Industrial",
    destinationRegion: "Sul",
    times: "06:40, 07:20, 18:10",
    totalSeats: 4,
    inRoute: true
  });

  const calculatedPrice = calculateRegionFare(draft.originRegion, draft.destinationRegion);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function createRoute() {
    onCreateRoute({
      from: draft.from,
      originRegion: draft.originRegion,
      through: draft.through.split(",").map((item) => item.trim()).filter(Boolean),
      to: draft.to,
      destinationRegion: draft.destinationRegion,
      times: draft.times.split(",").map((item) => item.trim()).filter(Boolean),
      totalSeats: Number(draft.totalSeats),
      price: calculatedPrice,
      inRoute: draft.inRoute
    });
  }

  return (
    <div className="view-grid driver-grid">
      <section className="panel route-builder">
        <div className="section-title">
          <div>
            <span>Area do Motorista</span>
            <h1>Criar rota personalizada</h1>
          </div>
          <button className="primary-button compact" onClick={createRoute}><Plus size={17} />Publicar rota</button>
        </div>
        <div className="fare-board">
          <div>
            <span>Tabela por regioes</span>
            <strong>Centro: R$ {regionPrices.center},00 - Extremos: R$ {regionPrices.extreme},00</strong>
          </div>
          <div>
            <span>Valor calculado</span>
            <strong>R$ {calculatedPrice},00</strong>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Motorista" value={user.name} />
          <Field label="Documento" value="CNH validada" icon={FileCheck2} />
          <Field label="Bairro de saida" value={draft.from} onChange={(value) => updateDraft("from", value)} />
          <SelectField label="Regiao de saida" value={draft.originRegion} options={regionOptions} onChange={(value) => updateDraft("originRegion", value)} />
          <Field label="Destino final" value={draft.to} onChange={(value) => updateDraft("to", value)} />
          <SelectField label="Regiao de destino" value={draft.destinationRegion} options={regionOptions} onChange={(value) => updateDraft("destinationRegion", value)} />
          <Field label="Bairros de passagem" value={draft.through} onChange={(value) => updateDraft("through", value)} wide />
          <Field label="Horarios disponiveis" value={draft.times} onChange={(value) => updateDraft("times", value)} />
          <Field label="Quantidade de vagas" value={draft.totalSeats} onChange={(value) => updateDraft("totalSeats", value)} />
          <Field label="Valor por regiao" value={`R$ ${calculatedPrice},00`} />
          <label className="toggle-field">
            <input type="checkbox" checked={draft.inRoute} onChange={(event) => updateDraft("inRoute", event.target.checked)} />
            Disponibilizar como em rota agora se houver vaga
          </label>
        </div>
      </section>
      <section className="panel route-management">
        <div className="section-title">
          <div>
            <span>Rotas ativas</span>
            <h1>Controle de vagas e ganhos</h1>
          </div>
        </div>
        <div className="driver-routes">
          {driverRoutes.map((route) => (
            <div className="driver-route" key={route.name}>
              <div>
                <strong>{route.name}</strong>
                <span>Proxima saida {route.next}</span>
              </div>
              <div className="occupancy">
                <div style={{ width: `${route.occupancy}%` }} />
              </div>
              <strong>{route.revenue}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel approval-panel">
        <div className="section-title">
          <div>
            <span>Reservas</span>
            <h1>Aceitar passageiros</h1>
          </div>
        </div>
        {["Lucas M.", "Priscila A.", "Joao V."].map((name) => (
          <div className="passenger-request" key={name}>
            <UserCheck size={20} />
            <div>
              <strong>{name}</strong>
              <span>Pagamento autorizado - 4.8 avaliacao</span>
            </div>
            <button className="ghost-button">Aceitar</button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Field({ label, value, wide, icon: Icon, onChange }) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <div>
        {Icon && <Icon size={17} />}
        <input value={value} onChange={(event) => onChange?.(event.target.value)} readOnly={!onChange} />
      </div>
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ProfileArea({ user, onSave }) {
  const [profile, setProfile] = useState({
    name: user.name,
    avatar: user.avatar,
    phone: user.phone || "",
    pixKey: user.pixKey || ""
  });
  const [saved, setSaved] = useState(false);

  async function saveProfile() {
    await onSave(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="view-grid profile-grid">
      <section className="panel profile-editor">
        <div className="section-title">
          <div>
            <span>Perfil</span>
            <h1>Foto, contato e Pix</h1>
          </div>
        </div>
        <div className="profile-preview">
          <img src={profile.avatar || defaultAvatar} alt={`Foto de ${profile.name}`} />
          <div>
            <strong>{profile.name}</strong>
            <span>{user.role === "driver" ? "Motorista" : "Cliente"}</span>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Nome" value={profile.name} onChange={(value) => setProfile((item) => ({ ...item, name: value }))} />
          <Field label="Numero de contato" value={profile.phone} onChange={(value) => setProfile((item) => ({ ...item, phone: value }))} />
          <Field label="URL da foto" value={profile.avatar} onChange={(value) => setProfile((item) => ({ ...item, avatar: value }))} wide />
          <Field label="Chave Pix cadastrada" value={profile.pixKey} onChange={(value) => setProfile((item) => ({ ...item, pixKey: value }))} wide />
        </div>
        <button className="primary-button profile-save" onClick={saveProfile}>
          <Check size={18} />
          {saved ? "Perfil salvo" : "Salvar perfil"}
        </button>
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <span>Pagamento</span>
            <h1>Pix no aplicativo</h1>
          </div>
        </div>
        <div className="pix-rules">
          <div><strong>Cliente</strong><span>visualiza a chave Pix ao reservar o assento.</span></div>
          <div><strong>Motorista</strong><span>recebe pagamentos pela chave Pix cadastrada no perfil.</span></div>
          <div><strong>Seguranca</strong><span>contato e chat ficam ligados a reserva.</span></div>
        </div>
      </section>
    </div>
  );
}

function SafetyArea({ selected, role }) {
  return (
    <div className="view-grid safety-grid">
      <section className="panel emergency-panel">
        <div className="section-title">
          <div>
            <span>Sistema de seguranca</span>
            <h1>{role === "driver" ? "Protecao para sua rota ativa" : "Viagem protegida e compartilhavel"}</h1>
          </div>
        </div>
        <button className="emergency-button">
          <AlertTriangle size={24} />
          Botao de emergencia
        </button>
        <div className="safety-actions">
          <button><ShieldCheck size={18} />Verificacao do motorista</button>
          <button><Navigation size={18} />Compartilhar viagem</button>
          <button><MessageCircle size={18} />Chat monitorado</button>
        </div>
      </section>
      <section className="map-panel wide-map">
        <RouteMap route={selected} />
      </section>
    </div>
  );
}

function FinanceArea() {
  return (
    <div className="view-grid finance-grid">
      {[
        ["Ganhos hoje", "R$ 216,00", "12 reservas confirmadas"],
        ["Saldo disponivel", "R$ 1.482,50", "Saque instantaneo via Pix"],
        ["Cupons usados", "34", "Campanhas de bairro"],
        ["Retencao", "87%", "Passageiros recorrentes"]
      ].map(([label, value, detail]) => (
        <section className="panel metric-panel" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <p>{detail}</p>
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
