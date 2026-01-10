from flask import Flask, request, jsonify, render_template_string
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from flask_cors import CORS
import json

# טעינת משתני סביבה (לריצה מקומית)
load_dotenv()

app = Flask(__name__)
# הפעלת CORS כדי שהאתר ב-Netlify יוכל לדבר עם השרת הזה
CORS(app)

# חיבור למסד הנתונים
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- HTML TEMPLATE ---
# (נשאר כאן כגיבוי, אבל בפועל אתה משתמש בקובץ index.html ב-Netlify)
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>API Running</title></head>
<body><h1>SmartStock Backend is Running! 🚀</h1></body>
</html>
"""

# --- Routes ---

@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

# 1. הרשמה וכניסה (Auth)
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    try:
        # יצירת משתמש ב-Supabase Auth
        auth = supabase.auth.sign_up({ "email": data['email'], "password": data['password'] })
        if auth.user:
            # יצירת פרופיל בטבלת profiles
            supabase.table("profiles").insert({ 
                "id": auth.user.id, 
                "username": data['email'].split('@')[0], 
                "business_name": data['business_name'] 
            }).execute()
            return jsonify({"message": "Registration successful"}), 201
        return jsonify({"error": "Registration failed"}), 400
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    try:
        auth = supabase.auth.sign_in_with_password({ "email": data['email'], "password": data['password'] })
        if auth.session:
            return jsonify({"access_token": auth.session.access_token}), 200
        return jsonify({"error": "Login failed"}), 401
    except Exception as e: return jsonify({"error": str(e)}), 400

# 2. פרופיל עסק
@app.route('/profile', methods=['GET', 'PUT'])
def handle_profile():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'GET':
            res = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
            return jsonify(res.data), 200
        if request.method == 'PUT':
            supabase.table("profiles").update(request.json).eq("id", user_id).execute()
            return jsonify({"msg": "Profile updated"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# 3. קטגוריות וספקים
@app.route('/categories', methods=['GET', 'POST'])
def handle_categories():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            supabase.table("categories").insert({"user_id": user_id, "name": request.json['name']}).execute()
            return jsonify({"msg": "Category added"}), 201
        res = supabase.table("categories").select("*").eq("user_id", user_id).execute()
        return jsonify(res.data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/categories/<int:id>', methods=['DELETE'])
def delete_category(id):
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        supabase.table("categories").delete().eq("id", id).eq("user_id", user_id).execute()
        return jsonify({"msg": "Deleted"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/suppliers', methods=['GET', 'POST'])
def handle_suppliers():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            supabase.table("suppliers").insert({"user_id": user_id, "name": request.json['name'], "phone": request.json.get('phone')}).execute()
            return jsonify({"msg": "Supplier added"}), 201
        res = supabase.table("suppliers").select("*").eq("user_id", user_id).execute()
        return jsonify(res.data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/suppliers/<int:id>', methods=['DELETE'])
def delete_supplier(id):
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        supabase.table("suppliers").delete().eq("id", id).eq("user_id", user_id).execute()
        return jsonify({"msg": "Deleted"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# 4. מוצרים (Products)
@app.route('/products', methods=['GET', 'POST'])
def handle_products():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            d = request.json
            d['user_id'] = user_id
            # המרה למספרים למקרה שהגיע כמחרוזת
            if 'category_id' in d and d['category_id'] == "": d['category_id'] = None
            if 'supplier_id' in d and d['supplier_id'] == "": d['supplier_id'] = None
            
            supabase.table("products").insert(d).execute()
            return jsonify({"msg": "Product added"}), 201
        
        # שליפת מוצרים ממוינים לפי ID
        res = supabase.table("products").select("*").eq("user_id", user_id).order('id').execute()
        return jsonify(res.data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/products/<int:id>', methods=['PUT', 'DELETE'])
def handle_single_product(id):
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'PUT':
            supabase.table("products").update(request.json).eq("id", id).eq("user_id", user_id).execute()
            return jsonify({"msg": "Updated"}), 200
        if request.method == 'DELETE':
            supabase.table("products").delete().eq("id", id).eq("user_id", user_id).execute()
            return jsonify({"msg": "Deleted"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# 5. לקוחות (Customers)
@app.route('/customers', methods=['GET', 'POST'])
def handle_customers():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            d = request.json
            d['user_id'] = user_id
            supabase.table("customers").insert(d).execute()
            return jsonify({"msg": "Customer added"}), 201
        res = supabase.table("customers").select("*").eq("user_id", user_id).execute()
        return jsonify(res.data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/customers/<int:id>', methods=['DELETE'])
def delete_customer(id):
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        supabase.table("customers").delete().eq("id", id).eq("user_id", user_id).execute()
        return jsonify({"msg": "Deleted"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# 6. הזמנות (Orders & POS Logic)
@app.route('/orders', methods=['GET', 'POST'])
def handle_orders():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        
        if request.method == 'GET':
            # שליפת הזמנות מהחדש לישן
            res = supabase.table("orders").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            return jsonify(res.data), 200

        if request.method == 'POST':
            data = request.json
            items = data['items'] # רשימת פריטים: [{product_id, quantity}]
            cust_id = data.get('customer_id') 
            if cust_id == "": cust_id = None
            
            total = 0
            order_items_to_insert = []
            
            # לולאה על כל פריט בהזמנה
            for item in items:
                # 1. שליפת מידע עדכני על המוצר (מחיר, עלות, מלאי)
                prod_res = supabase.table("products").select("*").eq("id", item['product_id']).single().execute()
                prod = prod_res.data
                
                # חישוב מחיר לשורה
                qty = int(item['quantity'])
                line_total = prod['sell_price'] * qty
                total += line_total
                
                # 2. עדכון המלאי (הפחתה)
                new_qty = prod['quantity'] - qty
                supabase.table("products").update({"quantity": new_qty}).eq("id", prod['id']).execute()
                
                # 3. הכנת הנתונים לטבלת הפירוט (שומרים את המחירים של אותו רגע!)
                order_items_to_insert.append({
                    "product_id": prod['id'],
                    "product_name": prod['name'],
                    "quantity": qty,
                    "sell_price": prod['sell_price'],
                    "cost_price": prod['cost_price'] # חשוב לחישוב רווח עתידי
                })

            # מציאת שם הלקוח (אם נבחר) לשמירה בהזמנה לנוחות
            cust_name = None
            if cust_id:
                c_res = supabase.table("customers").select("name").eq("id", cust_id).single().execute()
                cust_name = c_res.data['name']

            # 4. יצירת ההזמנה הראשית
            order_res = supabase.table("orders").insert({
                "user_id": user_id,
                "customer_id": cust_id,
                "customer_name": cust_name,
                "total_amount": total
            }).execute()
            
            new_order_id = order_res.data[0]['id']

            # 5. הכנסת פריטי ההזמנה לטבלת order_items
            for i in order_items_to_insert:
                i['order_id'] = new_order_id
            
            supabase.table("order_items").insert(order_items_to_insert).execute()

            return jsonify({"msg": "Order created successfully"}), 201

    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/orders/<int:oid>/items', methods=['GET'])
def get_order_items(oid):
    token = request.headers.get('Authorization')
    try:
        # שליפת הפריטים של הזמנה ספציפית
        res = supabase.table("order_items").select("*").eq("order_id", oid).execute()
        return jsonify(res.data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# 7. סטטיסטיקה ודשבורד (כולל רווח תפעולי)
@app.route('/stats', methods=['GET'])
def get_stats():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        
        # שליפת כל הנתונים הרלוונטיים
        prods = supabase.table("products").select("*").eq("user_id", user_id).execute().data
        orders = supabase.table("orders").select("id, total_amount").eq("user_id", user_id).execute().data
        
        total_items = len(prods)
        
        # חישוב שווי מלאי נוכחי (לפי מחיר עלות)
        total_inventory_value = sum([p['quantity'] * (p.get('cost_price') or 0) for p in prods])
        
        # סה"כ מכירות
        total_sales = sum([o['total_amount'] for o in orders])
        
        # מוצרים במלאי נמוך
        low_stock = len([p for p in prods if p['quantity'] <= p['reorder_level']])

        # --- חישוב רווח תפעולי (Operating Profit) ---
        total_profit = 0
        if orders:
            # שולפים את כל ה-IDs של ההזמנות כדי למצוא את הפריטים שלהן
            order_ids = [o['id'] for o in orders]
            if order_ids:
                # שימוש בפילטר in_ לשליפת כל הפריטים שנמכרו
                sold_items = supabase.table("order_items").select("*").in_("order_id", order_ids).execute().data
                
                for item in sold_items:
                    sell = item['sell_price']
                    cost = item['cost_price'] or 0 
                    qty = item['quantity']
                    # הרווח הוא (מחיר מכירה - מחיר עלות) * כמות
                    total_profit += (sell - cost) * qty

        return jsonify({
            "total_items": total_items,
            "total_value": total_inventory_value,
            "total_sales": total_sales,
            "total_profit": total_profit,
            "low_stock": low_stock
        })
    except Exception as e: return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
