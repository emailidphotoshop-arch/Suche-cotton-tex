
import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { ShoppingCart, Store, Heart, Package, Truck, Search, User } from "lucide-react";

/* ---------------- FIREBASE CONFIG ---------------- */

let app = null;
let db = null;
let auth = null;

try {
  const firebaseConfig = {
    apiKey: "AIzaSyBXGpQjrtko3iKpQeL9D__m91V73QDTwDg",
    authDomain: "suchecotton-2599f.firebaseapp.com",
    projectId: "suchecotton-2599f",
    storageBucket: "suchecotton-2599f.appspot.com",
    messagingSenderId: "339056868111",
    appId: "1:339056868111:web:eeda6749e717aa5f635c7a"
  };

  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.error("Firebase failed to initialize", e);
}

const firebaseReady = !!db;

/* ---------------- UTILITIES ---------------- */

export function calculateCartTotal(items) {
  if (!Array.isArray(items)) return 0;

  return items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.qty) || 0;
    return sum + price * qty;
  }, 0);
}

export function toggleWishlist(list, product) {
  const exists = list.find((p) => p.id === product.id);
  if (exists) return list.filter((p) => p.id !== product.id);
  return [...list, product];
}

export function generateInvoice(order) {
  if (!order) return "";

  const items = order.items
    .map((i) => `${i.name} x${i.qty} - ₹${i.price * i.qty}`)
    .join("\n");

  return `SUCHE COTTON INVOICE\n----------------------\nCustomer: ${order.username}\nAddress: ${order.address}\n\n${items}\n\nTotal: ₹${order.total}\nStatus: ${order.status}`;
}

/* ---------------- LOGIN SCREEN ---------------- */

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login");

  const handleLogin = async () => {
    try {
      if (!auth) throw new Error("Firebase not ready");
      await signInWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (e) {
      setError("Invalid email or password");
    }
  };

  const handleSignup = async () => {
    try {
      if (!auth) throw new Error("Firebase not ready");
      await createUserWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (e) {
      setError("Unable to create account");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf7f2] p-6">
      <div className="bg-white rounded-3xl shadow p-10 max-w-md w-full text-center space-y-6">

        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full overflow-hidden border shadow">
            <img src="/suche-logo.png" alt="Suche Cotton" className="w-full h-full object-cover" />
          </div>
          <div className="text-3xl font-bold text-pink-900">Suche Cotton</div>
        </div>

        <p className="text-gray-600">
          {mode === "login" ? "Login to enter store" : "Create a new account"}
        </p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-3 rounded w-full"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-3 rounded w-full"
        />

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {mode === "login" ? (
          <button onClick={handleLogin} className="bg-pink-700 text-white w-full py-3 rounded-xl">
            Login
          </button>
        ) : (
          <button onClick={handleSignup} className="bg-green-700 text-white w-full py-3 rounded-xl">
            Create Account
          </button>
        )}

        <button
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "signup" : "login");
          }}
          className="text-sm text-gray-600 underline"
        >
          {mode === "login" ? "Create new account" : "Already have an account? Login"}
        </button>

      </div>
    </div>
  );
}

/* ---------------- MAIN APP ---------------- */

export default function SareeStore() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [page, setPage] = useState("home");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!firebaseReady) return;

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(list);
    });

    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(list);
    });

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, []);

  if (!loggedIn) return <LoginScreen onLogin={(email)=>{setUserEmail(email);setLoggedIn(true)}} />;

  const addToCart = (product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;

    if (!username || !address) {
      alert("Please add your name and address in your profile before ordering.");
      setPage("profile");
      return;
    }

    const order = {
      items: cart,
      total: calculateCartTotal(cart),
      status: "Processing",
      created: Date.now(),
      user: userEmail,
      username,
      phone,
      address
    };

    if (firebaseReady) {
      await addDoc(collection(db, "orders"), order);
    }

    setOrders((prev) => [...prev, order]);
    setCart([]);
  };

  const displayProducts = products
    .filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => (filter === "all" ? true : p.category === filter));

  const total = calculateCartTotal(cart);

  return (
    <div className="min-h-screen bg-[#faf7f2] pb-24 md:pb-8 p-4 md:p-8">

      <header className="flex items-center justify-between text-pink-900">
        <div className="flex items-center gap-3 text-2xl md:text-3xl font-bold">
          <div className="w-10 h-10 rounded-full overflow-hidden border">
            <img src="/suche-logo.png" alt="Suche Cotton" className="w-full h-full object-cover" />
          </div>
          Suche Cotton
        </div>
      </header>

      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={() => setPage("home")} className="px-3 py-1 bg-white rounded">Home</button>
        <button onClick={() => setPage("store")} className="px-3 py-1 bg-white rounded">Store</button>
        <button onClick={() => setPage("wishlist")} className="px-3 py-1 bg-white rounded">Wishlist</button>
        <button onClick={() => setPage("cart")} className="px-3 py-1 bg-white rounded">Cart</button>
        <button onClick={() => setPage("orders")} className="px-3 py-1 bg-white rounded">Orders</button>
      </div>

      <div className="mt-10 text-center text-gray-500">
        Suche Cotton Store Ready
      </div>

    </div>
  );
}
