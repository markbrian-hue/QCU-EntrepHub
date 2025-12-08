using Microsoft.EntityFrameworkCore;
using QCU.Backend.Models;

namespace QCU.Backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Product> Products { get; set; }
        public DbSet<Vendor> Vendors { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // ==========================
            // 1. MAPPING FOR PRODUCTS
            // ==========================
            modelBuilder.Entity<Product>().ToTable("products");
            
            modelBuilder.Entity<Product>().Property(p => p.ProductId).HasColumnName("product_id");
            modelBuilder.Entity<Product>().Property(p => p.VendorId).HasColumnName("vendor_id");
            modelBuilder.Entity<Product>().Property(p => p.Name).HasColumnName("name");
            modelBuilder.Entity<Product>().Property(p => p.Price).HasColumnName("price");
            modelBuilder.Entity<Product>().Property(p => p.StockQuantity).HasColumnName("stock_quantity");
            
            // Map the nullable fields
            modelBuilder.Entity<Product>().Property(p => p.Category).HasColumnName("category");
            modelBuilder.Entity<Product>().Property(p => p.ImageUrl).HasColumnName("image_url");
            modelBuilder.Entity<Product>().Property(p => p.Description).HasColumnName("description");

            // ==========================
            // 2. MAPPING FOR VENDORS
            // ==========================
           modelBuilder.Entity<Vendor>().ToTable("vendors");

            modelBuilder.Entity<Vendor>().Property(v => v.VendorId).HasColumnName("vendor_id");
            modelBuilder.Entity<Vendor>().Property(v => v.UserId).HasColumnName("user_id");
            modelBuilder.Entity<Vendor>().Property(v => v.ShopName).HasColumnName("shop_name");
            modelBuilder.Entity<Vendor>().Property(v => v.IsOpen).HasColumnName("is_open");
            
            // Ensure these are mapped correctly as nullable
            modelBuilder.Entity<Vendor>().Property(v => v.CourseSection).HasColumnName("course_section");
            modelBuilder.Entity<Vendor>().Property(v => v.GcashNumber).HasColumnName("gcash_number");
            modelBuilder.Entity<Vendor>().Property(v => v.ShopDescription).HasColumnName("shop_description");
            // ==========================
            // 3. MAPPING FOR USERS
            // ==========================
            modelBuilder.Entity<User>().ToTable("users");

            modelBuilder.Entity<User>().Property(u => u.UserId).HasColumnName("user_id");
            modelBuilder.Entity<User>().Property(u => u.StudentNumber).HasColumnName("student_number");
            modelBuilder.Entity<User>().Property(u => u.FullName).HasColumnName("full_name");
            modelBuilder.Entity<User>().Property(u => u.PasswordHash).HasColumnName("password_hash");
            modelBuilder.Entity<User>().Property(u => u.Role).HasColumnName("role");
            modelBuilder.Entity<User>().Property(u => u.CreatedAt).HasColumnName("created_at");

            // ==========================
            // 4. MAPPING FOR ORDERS
            // ==========================
            modelBuilder.Entity<Order>().ToTable("orders");

            modelBuilder.Entity<Order>().Property(o => o.OrderId).HasColumnName("order_id");
            modelBuilder.Entity<Order>().Property(o => o.CustomerId).HasColumnName("customer_id");
            modelBuilder.Entity<Order>().Property(o => o.VendorId).HasColumnName("vendor_id");
            modelBuilder.Entity<Order>().Property(o => o.TotalAmount).HasColumnName("total_amount");
            modelBuilder.Entity<Order>().Property(o => o.Status).HasColumnName("status");
            
            // <--- THIS WAS THE MISSING LINE CAUSING THE ERROR
            modelBuilder.Entity<Order>().Property(o => o.DeliveryMethod).HasColumnName("delivery_method"); 
            
            modelBuilder.Entity<Order>().Property(o => o.DeliveryLocation).HasColumnName("delivery_location");
            modelBuilder.Entity<Order>().Property(o => o.PaymentMethod).HasColumnName("payment_method");
            modelBuilder.Entity<Order>().Property(o => o.CreatedAt).HasColumnName("created_at");

            // ==========================
            // 5. MAPPING FOR ORDER ITEMS
            // ==========================
            modelBuilder.Entity<OrderItem>().ToTable("order_items");
            
            modelBuilder.Entity<OrderItem>().Property(oi => oi.OrderItemId).HasColumnName("order_item_id");
            modelBuilder.Entity<OrderItem>().Property(oi => oi.OrderId).HasColumnName("order_id");
            modelBuilder.Entity<OrderItem>().Property(oi => oi.ProductId).HasColumnName("product_id");
            modelBuilder.Entity<OrderItem>().Property(oi => oi.Quantity).HasColumnName("quantity");
            modelBuilder.Entity<OrderItem>().Property(oi => oi.PriceAtOrder).HasColumnName("price_at_order");
        }
    }
}