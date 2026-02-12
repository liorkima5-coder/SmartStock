from flask import Flask, request, jsonify, render_template_string
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from flask_cors import CORS
import json
from datetime import datetime, timedelta

# טעינת משתני סביבה
load_dotenv()

app = Flask(__name__)
CORS(app)

# חיבור לדאטה בייס
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- דף הבית ---
@app.route('/')
def home():
    return "SmartStock Backend v14.0 (Enhanced) is Running! 🚀"

# --- 1. משתמשים והרשמה ---
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    try:
        auth = supabase.auth.sign_up({ "email": data['email'], "password": data['password'] })
        if auth.user:
            supabase.table("profiles").insert({ 
                "id": auth.user.id, 
                "username": data['email'].split('@')[0], 
                "business_name": data['business_name'] 
            }).execute()
            return jsonify({"message": "OK"}), 201
        return jsonify({"error": "Failed"}), 400
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

@app.route('/profile', methods=['GET', 'PUT'])
def handle_profile():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'GET':
            return jsonify(supabase.table("profiles").select("*").eq("id", user_id).single().execute().data), 200
        if request.method == 'PUT':
            # עדכון כל השדות שהתקבלו
            supabase.table("profiles").update(request.json).eq("id", user_id).execute()
            return jsonify({"msg": "Updated"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# --- 2. ניהול מוצרים וקטגוריות ---
@app.route('/products', methods=['GET', 'POST'])
def handle_products():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            d = request.json
            d['user_id'] = user_id
            if d.get('category_id') == "": d['category_id'] = None
            if d.get('supplier_id') == "": d['supplier_id'] = None
            
            supabase.table("products").insert(d).execute()
            return jsonify({"msg": "Added"}), 201
        
        return jsonify(supabase.table("products").select("*").eq("user_id", user_id).order('id').execute().data), 200
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

@app.route('/categories', methods=['GET', 'POST'])
def handle_categories():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            supabase.table("categories").insert({"user_id": user_id, "name": request.json['name']}).execute()
            return jsonify({"msg": "Added"}), 201
        return jsonify(supabase.table("categories").select("*").eq("user_id", user_id).execute().data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/suppliers', methods=['GET', 'POST'])
def handle_suppliers():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            supabase.table("suppliers").insert({"user_id": user_id, "name": request.json['name']}).execute()
            return jsonify({"msg": "Added"}), 201
        return jsonify(supabase.table("suppliers").select("*").eq("user_id", user_id).execute().data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/customers', methods=['GET', 'POST'])
def handle_customers():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'POST':
            d = request.json
            d['user_id'] = user_id
            supabase.table("customers").insert(d).execute()
            return jsonify({"msg": "Added"}), 201
        return jsonify(supabase.table("customers").select("*").eq("user_id", user_id).execute().data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/customers/<int:id>', methods=['PUT', 'DELETE'])
def handle_single_customer(id):
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        if request.method == 'DELETE':
            supabase.table("customers").delete().eq("id", id).eq("user_id", user_id).execute()
            return jsonify({"msg": "Deleted"}), 200
        if request.method == 'PUT':
            supabase.table("customers").update(request.json).eq("id", id).eq("user_id", user_id).execute()
            return jsonify({"msg": "Updated"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# --- 3. הזמנות וקופה ---
@app.route('/orders', methods=['GET', 'POST'])
def handle_orders():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        
        if request.method == 'GET':
            return jsonify(supabase.table("orders").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute().data), 200

        if request.method == 'POST':
            data = request.json
            items = data['items']
            cust_id = data.get('customer_id') or None
            payment = data.get('payment_method', 'Cash')
            
            total = 0
            order_items_to_insert = []
            
            for item in items:
                prod = supabase.table("products").select("*").eq("id", item['product_id']).single().execute().data
                qty = int(item['quantity'])
                total += prod['sell_price'] * qty
                
                new_qty = prod['quantity'] - qty
                supabase.table("products").update({"quantity": new_qty}).eq("id", prod['id']).execute()
                
                order_items_to_insert.append({
                    "product_id": prod['id'],
                    "product_name": prod['name'],
                    "quantity": qty,
                    "sell_price": prod['sell_price'],
                    "cost_price": prod['cost_price']
                })

            cust_name = None
            if cust_id:
                cust = supabase.table("customers").select("name").eq("id", cust_id).single().execute().data
                cust_name = cust['name']

            order_res = supabase.table("orders").insert({
                "user_id": user_id,
                "customer_id": cust_id,
                "customer_name": cust_name,
                "total_amount": total,
                "payment_method": payment
            }).execute()
            
            new_oid = order_res.data[0]['id']

            for i in order_items_to_insert:
                i['order_id'] = new_oid
            
            supabase.table("order_items").insert(order_items_to_insert).execute()

            return jsonify({"msg": "Success", "order_id": new_oid}), 201

    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/orders/<int:oid>/items', methods=['GET'])
def get_order_items(oid):
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        res = supabase.table("order_items").select("*").eq("order_id", oid).execute()
        return jsonify(res.data), 200
    except Exception as e: return jsonify({"error": str(e)}), 400

# --- 4. אנליטיקה חכמה ---
@app.route('/analytics', methods=['GET'])
def get_analytics():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        
        orders = supabase.table("orders").select("id").eq("user_id", user_id).execute().data
        prods = supabase.table("products").select("*").eq("user_id", user_id).execute().data
        
        if not orders:
            return jsonify({"abc": [], "forecast": []}), 200

        order_ids = [o['id'] for o in orders]
        if not order_ids:
             return jsonify({"abc": [], "forecast": []}), 200

        sold_items = supabase.table("order_items").select("*").in_("order_id", order_ids).execute().data

        # ABC Analysis
        product_revenue = {}
        total_revenue = 0
        for item in sold_items:
            rev = item['quantity'] * item['sell_price']
            pid = item['product_id']
            product_revenue[pid] = product_revenue.get(pid, 0) + rev
            total_revenue += rev
            
        sorted_sales = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)
        abc_list = []
        running_sum = 0
        
        for pid, revenue in sorted_sales:
            p_obj = next((p for p in prods if p['id'] == pid), None)
            p_name = p_obj['name'] if p_obj else "Unknown Product"
            running_sum += revenue
            percentage = 0
            if total_revenue > 0: percentage = running_sum / total_revenue
            grade = 'C'
            if percentage <= 0.80: grade = 'A'
            elif percentage <= 0.95: grade = 'B'
            abc_list.append({"name": p_name, "revenue": revenue, "grade": grade})

        # Forecast
        forecast_list = []
        product_sold_total = {}
        for item in sold_items:
            product_sold_total[item['product_id']] = product_sold_total.get(item['product_id'], 0) + item['quantity']

        for p in prods:
            sold_count = product_sold_total.get(p['id'], 0)
            if sold_count == 0: continue
            daily_burn = sold_count / 30.0 
            days_left = 999
            if daily_burn > 0: days_left = int(p['quantity'] / daily_burn)
            forecast_list.append({"name": p['name'], "stock": p['quantity'], "days_left": days_left})
        
        forecast_list.sort(key=lambda x: x['days_left'])
        return jsonify({"abc": abc_list[:5], "forecast": forecast_list[:5]}), 200

    except Exception as e: return jsonify({"error": str(e), "abc": [], "forecast": []}), 200

# --- 5. סטטיסטיקה ---
@app.route('/stats', methods=['GET'])
def get_stats():
    token = request.headers.get('Authorization')
    try:
        user_id = supabase.auth.get_user(token.replace("Bearer ", "")).user.id
        prods = supabase.table("products").select("*").eq("user_id", user_id).execute().data
        orders = supabase.table("orders").select("id, total_amount").eq("user_id", user_id).execute().data
        
        total_items = len(prods)
        total_inventory_value = sum([p['quantity'] * (p.get('cost_price') or 0) for p in prods])
        total_sales = sum([o['total_amount'] for o in orders])
        low_stock = len([p for p in prods if p['quantity'] <= p['reorder_level']]) if prods else 0

        total_profit = 0
        if orders:
            order_ids = [o['id'] for o in orders]
            if order_ids:
                sold_items = supabase.table("order_items").select("*").in_("order_id", order_ids).execute().data
                for item in sold_items:
                    sell = item['sell_price']
                    cost = item['cost_price'] or 0 
                    qty = item['quantity']
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
