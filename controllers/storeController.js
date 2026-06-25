const StoreProduct = require('../models/StoreProduct');
const StoreOrder = require('../models/StoreOrder');
const User = require('../models/User');

// --- PRODUCTS ---

exports.getPartnerProducts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const partnerId = user.partnerId;
    if (!partnerId) return res.status(400).json({ success: false, message: 'Bạn chưa có người kết đôi.' });

    const products = await StoreProduct.find({ user: partnerId, isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error('getPartnerProducts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const products = await StoreProduct.find({ user: req.user.id, isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error('getMyProducts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, price } = req.body;
    let image = req.body.image; // fallback for direct URL if needed

    if (req.file) {
      image = req.file.path;
    }

    if (!name || price == null || !image) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin và chọn ảnh.' });
    }

    const product = new StoreProduct({
      user: req.user.id,
      name,
      price: Number(price),
      image
    });

    await product.save();
    res.status(201).json({ success: true, data: product, message: 'Đăng sản phẩm thành công.' });
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price } = req.body;

    const product = await StoreProduct.findOne({ _id: id, user: req.user.id });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    if (name) product.name = name;
    if (price != null) product.price = Number(price);
    
    if (req.file) {
      product.image = req.file.path;
    } else if (req.body.image) {
      // Allow fallback if front-end passes image url
      product.image = req.body.image;
    }

    await product.save();
    res.status(200).json({ success: true, data: product, message: 'Cập nhật sản phẩm thành công.' });
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await StoreProduct.findOne({ _id: id, user: req.user.id });
    
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    product.isActive = false;
    await product.save();
    res.status(200).json({ success: true, message: 'Đã xoá sản phẩm.' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// --- ORDERS ---

exports.buyProduct = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const qty = parseInt(quantity);
    
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Số lượng không hợp lệ.' });
    }

    const user = await User.findById(req.user.id);
    const partnerId = user.partnerId;
    if (!partnerId) return res.status(400).json({ success: false, message: 'Bạn chưa có người kết đôi.' });

    const product = await StoreProduct.findOne({ _id: productId, isActive: true });
    if (!product) return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại hoặc đã bị ẩn.' });

    if (product.user.toString() !== partnerId.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ có thể mua sản phẩm của đối phương.' });
    }

    const totalPrice = product.price * qty;

    if (user.heart < totalPrice) {
      return res.status(400).json({ success: false, message: `Bạn không đủ Heart để mua ${qty} món này.` });
    }

    // Trừ heart
    user.heart -= totalPrice;
    await user.save();
    
    // Tạo order
    const order = new StoreOrder({
      buyer: req.user.id,
      seller: partnerId,
      product: product._id,
      priceAtPurchase: totalPrice,
      quantity: qty,
      status: 'pending'
    });

    await order.save();
    
    // Trả về order đã populate product để FE cập nhật state
    const populatedOrder = await StoreOrder.findById(order._id).populate('product');

    res.status(200).json({ success: true, data: populatedOrder, message: 'Đặt hàng thành công!' });
  } catch (error) {
    console.error('buyProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await StoreOrder.find({ buyer: req.user.id })
      .populate('product')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error('getMyOrders error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getPartnerOrders = async (req, res) => {
  try {
    const orders = await StoreOrder.find({ seller: req.user.id })
      .populate('product')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error('getPartnerOrders error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'cancel', 'reject', 'confirm', 'fulfill'
    
    const order = await StoreOrder.findById(id).populate('product');
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const isBuyer = order.buyer.toString() === req.user.id;
    const isSeller = order.seller.toString() === req.user.id;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Không có quyền thay đổi trạng thái đơn này.' });
    }

    if (action === 'cancel') {
      if (!isBuyer) return res.status(403).json({ success: false, message: 'Chỉ người mua mới có thể huỷ đơn.' });
      if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'Chỉ có thể huỷ đơn đang chờ.' });
      
      order.status = 'cancelled';
      // Hoàn tiền
      const buyer = await User.findById(order.buyer);
      buyer.heart += order.priceAtPurchase;
      await buyer.save();

    } else if (action === 'reject') {
      if (!isSeller) return res.status(403).json({ success: false, message: 'Chỉ người bán mới có thể từ chối đơn.' });
      if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'Chỉ có thể từ chối đơn đang chờ.' });
      
      order.status = 'rejected';
      // Hoàn tiền
      const buyer = await User.findById(order.buyer);
      buyer.heart += order.priceAtPurchase;
      await buyer.save();

    } else if (action === 'confirm') {
      if (!isSeller) return res.status(403).json({ success: false, message: 'Chỉ người bán mới có thể xác nhận đơn.' });
      if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận đơn đang chờ.' });
      
      order.status = 'confirmed';

    } else if (action === 'fulfill') {
      if (!isSeller) return res.status(403).json({ success: false, message: 'Chỉ người bán mới có thể cập nhật trạng thái đã thực hiện.' });
      if (order.status !== 'confirmed') return res.status(400).json({ success: false, message: 'Chỉ có thể thực hiện đơn đã xác nhận.' });
      
      order.status = 'fulfilled';

      // Tăng số lượng đã bán khi đơn hoàn thành
      const soldProduct = await StoreProduct.findById(order.product._id || order.product);
      if (soldProduct) {
        soldProduct.sold = (soldProduct.sold || 0) + (order.quantity || 1);
        await soldProduct.save();
      }

    } else {
      return res.status(400).json({ success: false, message: 'Action không hợp lệ.' });
    }

    await order.save();
    res.status(200).json({ success: true, data: order, message: 'Cập nhật trạng thái thành công.' });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
