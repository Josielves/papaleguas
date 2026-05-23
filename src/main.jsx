import React, { useMemo, useState } from "react";
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
import "./styles.css";

const routes = [
  {
    id: 1,
    driver: "Marina Costa",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
    rating: 4.9,
    vehicle: "Onix Plus prata",
    plate: "BRA-2E18",
    from: "Jardim America",
    through: ["Centro", "Vila Nova"],
    to: "Distrito Industrial",
    times: ["06:40", "07:20", "18:10"],
    seats: 3,
    price: 12,
    eta: "8 min"
  },
  {
    id: 2,
    driver: "Rafael Nunes",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
    rating: 4.8,
    vehicle: "Spin branca",
    plate: "PPL-7A40",
    from: "Parque das Flores",
    through: ["Santa Rita", "Rodoviaria"],
    to: "Centro",
    times: ["07:00", "12:15", "17:50"],
    seats: 5,
    price: 9,
    eta: "12 min"
  },
  {
    id: 3,
    driver: "Bianca Torres",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80",
    rating: 5.0,
    vehicle: "Kwid verde",
    plate: "FIX-9C21",
    from: "Cidade Alta",
    through: ["Mercado", "Faculdade"],
    to: "Hospital Municipal",
    times: ["05:55", "13:30", "22:10"],
    seats: 2,
    price: 10,
    eta: "5 min"
  }
];

const driverRoutes = [
  { name: "Jardim America -> Distrito Industrial", occupancy: 70, revenue: "R$ 216", next: "06:40" },
  { name: "Centro -> Vila Nova", occupancy: 92, revenue: "R$ 138", next: "12:20" },
  { name: "Santa Rita -> Rodoviaria", occupancy: 58, revenue: "R$ 81", next: "17:40" }
];

const demoUsers = [
  {
    id: 1,
    name: "Ana Beatriz",
    email: "cliente@papaleguas.com",
    password: "cliente123",
    role: "passenger",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80",
    badge: "Cliente fidelidade",
    walletLabel: "Fidelidade",
    walletValue: "1.840 pontos"
  },
  {
    id: 2,
    name: "Marina Costa",
    email: "motorista@papaleguas.com",
    password: "motorista123",
    role: "driver",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
    badge: "Motorista verificada",
    walletLabel: "Saldo",
    walletValue: "R$ 1.482,50"
  }
];

function App() {
  const [theme, setTheme] = useState("dark");
  const [view, setView] = useState("passenger");
  const [users, setUsers] = useState(demoUsers);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(routes[0]);
  const [reserved, setReserved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredRoutes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return routes;
    return routes.filter((route) =>
      [route.from, route.to, route.driver, route.vehicle, ...route.through].join(" ").toLowerCase().includes(term)
    );
  }, [query]);

  function openSession(user) {
    setCurrentUser(user);
    setView(user.role === "driver" ? "driver" : "passenger");
    setMenuOpen(false);
    setAuthError("");
  }

  function handleLogin({ email, password }) {
    const user = users.find(
      (account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password
    );

    if (!user) {
      setAuthError("Usuario ou senha invalidos.");
      return;
    }

    openSession(user);
  }

  function handleSignup({ name, email, password, role }) {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setAuthError("Preencha nome, usuario e uma senha com pelo menos 6 caracteres.");
      return;
    }

    if (users.some((account) => account.email.toLowerCase() === email.trim().toLowerCase())) {
      setAuthError("Este usuario ja existe.");
      return;
    }

    const newUser = {
      id: Date.now(),
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      avatar:
        role === "driver"
          ? "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80"
          : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80",
      badge: role === "driver" ? "Motorista em analise" : "Cliente novo",
      walletLabel: role === "driver" ? "Saldo" : "Fidelidade",
      walletValue: role === "driver" ? "R$ 0,00" : "0 pontos"
    };

    setUsers((accounts) => [...accounts, newUser]);
    openSession(newUser);
  }

  function handleLogout() {
    setCurrentUser(null);
    setView("passenger");
    setReserved(false);
    setMenuOpen(false);
  }

  if (!currentUser) {
    return (
      <main className={`app ${theme}`}>
        <AuthScreen error={authError} onLogin={handleLogin} onSignup={handleSignup} theme={theme} setTheme={setTheme} />
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
                setSelected(route);
                setReserved(false);
              }}
              reserved={reserved}
              setReserved={setReserved}
            />
          )}
          {view === "driver" && currentUser.role === "driver" && <DriverArea user={currentUser} />}
          {view === "safety" && <SafetyArea selected={selected} role={currentUser.role} />}
          {view === "finance" && currentUser.role === "driver" && <FinanceArea />}
        </div>
      </section>
    </main>
  );
}

function AuthScreen({ error, onLogin, onSignup, theme, setTheme }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("passenger");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("cliente@papaleguas.com");
  const [password, setPassword] = useState("cliente123");

  function submitAuth(event) {
    event.preventDefault();
    if (mode === "login") {
      onLogin({ email, password });
      return;
    }
    onSignup({ name, email, password, role });
  }

  function fillDemo(demoRole) {
    setMode("login");
    setRole(demoRole);
    setEmail(demoRole === "driver" ? "motorista@papaleguas.com" : "cliente@papaleguas.com");
    setPassword(demoRole === "driver" ? "motorista123" : "cliente123");
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

        <button className="primary-button" type="submit">
          <LogIn size={18} />
          {mode === "login" ? "Entrar" : "Criar e entrar"}
        </button>

        <div className="demo-logins">
          <button type="button" onClick={() => fillDemo("passenger")}>Usar cliente demo</button>
          <button type="button" onClick={() => fillDemo("driver")}>Usar motorista demo</button>
        </div>
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

function PassengerArea({ query, setQuery, routes, selected, setSelected, reserved, setReserved }) {
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
          <InfoLine icon={Route} label="Passa por" value={selected.through.join(", ")} />
          <InfoLine icon={Navigation} label="Destino" value={selected.to} />
          <InfoLine icon={Clock3} label="Horarios" value={selected.times.join(" / ")} />
        </div>
        <div className="payment-row">
          <div>
            <span>Valor fixo</span>
            <strong>R$ {selected.price},00</strong>
          </div>
          <CreditCard size={22} />
        </div>
        <button className={`primary-button ${reserved ? "done" : ""}`} onClick={() => setReserved(true)}>
          {reserved ? <Check size={18} /> : <Plus size={18} />}
          {reserved ? "Vaga reservada" : "Reservar assento"}
        </button>
        <div className="mini-actions">
          <button><MessageCircle size={16} />Chat</button>
          <button><History size={16} />Historico</button>
          <button><Star size={16} />Avaliar</button>
        </div>
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
        <strong>R$ {route.price}</strong>
      </div>
    </button>
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

function DriverArea({ user }) {
  return (
    <div className="view-grid driver-grid">
      <section className="panel route-builder">
        <div className="section-title">
          <div>
            <span>Area do Motorista</span>
            <h1>Criar rota personalizada</h1>
          </div>
          <button className="primary-button compact"><Plus size={17} />Nova rota</button>
        </div>
        <div className="form-grid">
          <Field label="Motorista" value={user.name} />
          <Field label="Documento" value="CNH validada" icon={FileCheck2} />
          <Field label="Bairro de saida" value="Jardim America" />
          <Field label="Destino final" value="Distrito Industrial" />
          <Field label="Bairros de passagem" value="Centro, Vila Nova" wide />
          <Field label="Horarios disponiveis" value="06:40, 07:20, 18:10" />
          <Field label="Quantidade de vagas" value="4" />
          <Field label="Valor fixo da rota" value="R$ 12,00" />
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

function Field({ label, value, wide, icon: Icon }) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <div>
        {Icon && <Icon size={17} />}
        <input defaultValue={value} />
      </div>
    </label>
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
